package service

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"

	"foto-app/internal/domain/model"
	"foto-app/internal/domain/port"
)

// ---------- Request/Response types ----------

// InitiatePaymentResponse carries the result of initiating a payment.
type InitiatePaymentResponse struct {
	Payment   *model.Payment `json:"payment"`
	PaymentURL *string       `json:"payment_url,omitempty"` // MP init_point
}

// MPWebhookPayload represents the incoming Mercado Pago webhook body.
type MPWebhookPayload struct {
	Action   string          `json:"action"`
	Type     string          `json:"type"`
	Data     *MPWebhookData  `json:"data"`
	ID       json.Number     `json:"id"` // notification ID
}

// MPWebhookData holds the data.id field from the webhook.
type MPWebhookData struct {
	ID string `json:"id"`
}

// ---------- Payment Service ----------

// PaymentService implements business logic for payment processing.
// It coordinates between PaymentRepository, OrderRepository, and PaymentGateway
// to handle MP Checkout Pro payments and cash-on-delivery payments.
type PaymentService struct {
	paymentRepo port.PaymentRepository
	orderRepo   port.OrderRepository
	gateway     port.PaymentGateway
}

// NewPaymentService creates a PaymentService with its dependencies.
func NewPaymentService(
	paymentRepo port.PaymentRepository,
	orderRepo port.OrderRepository,
	gateway port.PaymentGateway,
) *PaymentService {
	return &PaymentService{
		paymentRepo: paymentRepo,
		orderRepo:   orderRepo,
		gateway:     gateway,
	}
}

// InitiatePayment starts the payment flow for an order.
//
// For "mercadopago": creates an MP Checkout Pro preference, stores the
// preference ID on the order, and returns the init_point URL.
//
// For "cash": creates a pending payment record. An admin must later
// confirm the payment via ConfirmCashPayment.
//
// Returns ErrOrderAlreadyPaid if the order has already been paid.
// Returns ErrInvalidPayment if the method does not match the order's method.
// Returns ErrNotFound if the order does not exist or doesn't belong to the student.
func (s *PaymentService) InitiatePayment(
	ctx context.Context,
	studentID uuid.UUID,
	orderID uuid.UUID,
	method string,
) (*InitiatePaymentResponse, error) {
	// 1. Find order
	order, err := s.orderRepo.FindByID(ctx, orderID)
	if err != nil {
		return nil, err
	}
	if order.StudentID != studentID {
		return nil, model.ErrNotFound
	}

	// 2. Validate payment method
	if order.PaymentMethod != method {
		return nil, model.ErrInvalidPayment
	}

	// 3. Check not already paid
	if order.PaymentStatus == model.PaymentStatusPaid {
		return nil, model.ErrOrderAlreadyPaid
	}

	// 4. Check existing payment record
	existingPayment, err := s.paymentRepo.FindByOrderID(ctx, orderID)
	if err != nil && !errors.Is(err, model.ErrNotFound) {
		return nil, err
	}
	if existingPayment != nil && existingPayment.Status == model.PaymentStatusApproved {
		return nil, model.ErrOrderAlreadyPaid
	}
	if existingPayment != nil && existingPayment.Status != model.PaymentStatusPending {
		// Payment exists in a terminal state — reject
		return nil, model.ErrOrderAlreadyPaid
	}

	switch method {
	case model.PaymentMethodMercadoPago:
		return s.initiateMP(ctx, order)
	case model.PaymentMethodCash:
		return s.initiateCash(ctx, order)
	default:
		return nil, model.ErrInvalidPayment
	}
}

func (s *PaymentService) initiateMP(ctx context.Context, order *model.Order) (*InitiatePaymentResponse, error) {
	// Get order items for MP preference
	items, err := s.orderRepo.FindItemsByOrderID(ctx, order.ID)
	if err != nil {
		return nil, fmt.Errorf("get order items: %w", err)
	}

	// Build MP preference items
	mpItems := make([]port.MPPreferenceItem, len(items))
	for i, it := range items {
		mpItems[i] = port.MPPreferenceItem{
			Title:      it.Title,
			Quantity:   it.Quantity,
			UnitPrice:  it.UnitPrice,
			CurrencyID: "ARS",
		}
	}

	// Create MP Checkout Pro preference
	backURLs := &port.MPBackURLs{
		Success: "",
		Failure: "",
		Pending: "",
	}
	pref, err := s.gateway.CreatePreference(ctx, order.ID.String(), mpItems, backURLs)
	if err != nil {
		return nil, errors.Join(model.ErrPaymentFailed, err)
	}

	// Persist payment record
	payment := &model.Payment{
		ID:                uuid.New(),
		OrderID:           order.ID,
		Method:            model.PaymentMethodMercadoPago,
		Status:            model.PaymentStatusPending,
		Amount:            order.Total,
		ExternalReference: strPtr(order.ID.String()),
		MPPaymentID:       &pref.ID,
	}
	if err := s.paymentRepo.Create(ctx, payment); err != nil {
		return nil, fmt.Errorf("create payment: %w", err)
	}

	// Store mp_preference_id on the order
	if err := s.orderRepo.SetMPPreferenceID(ctx, order.ID, pref.ID); err != nil {
		return nil, fmt.Errorf("set mp_preference_id: %w", err)
	}

	return &InitiatePaymentResponse{
		Payment:    payment,
		PaymentURL: &pref.InitPoint,
	}, nil
}

func (s *PaymentService) initiateCash(ctx context.Context, order *model.Order) (*InitiatePaymentResponse, error) {
	payment := &model.Payment{
		ID:                uuid.New(),
		OrderID:           order.ID,
		Method:            model.PaymentMethodCash,
		Status:            model.PaymentStatusPending,
		Amount:            order.Total,
		ExternalReference: strPtr(order.ID.String()),
	}

	if err := s.paymentRepo.Create(ctx, payment); err != nil {
		return nil, fmt.Errorf("create cash payment: %w", err)
	}

	return &InitiatePaymentResponse{
		Payment: payment,
	}, nil
}

// HandleMPWebhook processes an incoming Mercado Pago webhook notification.
//
// It is idempotent: if the same notification ID has already been processed,
// this is a no-op. The upsert uses the payment_events.event_id (MP notification ID)
// as the unique constraint.
//
// When processing a new "payment" event, it:
//  1. Queries MP API for the payment's current status
//  2. Finds the corresponding payment record by external_reference (order_id)
//  3. Updates the payment and order statuses accordingly
//
// Approved → order status: confirmed, payment_status: paid
// Rejected → payment_status: failed
func (s *PaymentService) HandleMPWebhook(ctx context.Context, rawBody json.RawMessage) error {
	var payload MPWebhookPayload
	if err := json.Unmarshal(rawBody, &payload); err != nil {
		return fmt.Errorf("parse webhook payload: %w", err)
	}

	if payload.Data == nil || payload.Data.ID == "" {
		return fmt.Errorf("missing data.id in webhook payload")
	}

	notificationID := payload.ID.String()
	if notificationID == "" || notificationID == "0" {
		// Generate a fallback ID if MP didn't provide one
		notificationID = payload.Data.ID + "-" + payload.Action
	}

	// Create event for idempotency check
	mpPaymentID := payload.Data.ID
	event := &model.PaymentEvent{
		ID:          uuid.New(),
		EventID:     notificationID,
		Topic:       payload.Type,
		Action:      payload.Action,
		MPPaymentID: &mpPaymentID,
		RawBody:     rawBody,
	}

	isNew, err := s.paymentRepo.UpsertEvent(ctx, event)
	if err != nil {
		return fmt.Errorf("upsert payment event: %w", err)
	}
	if !isNew {
		// Already processed — idempotent
		return nil
	}

	// Only process "payment" topic events
	if payload.Type != "payment" {
		return nil
	}

	// Query MP for payment status
	// The data.id might be a string that represents an integer
	var paymentID int
	if _, err := fmt.Sscanf(mpPaymentID, "%d", &paymentID); err != nil {
		return fmt.Errorf("parse mp payment id %q: %w", mpPaymentID, err)
	}

	mpInfo, err := s.gateway.GetPaymentInfo(ctx, paymentID)
	if err != nil {
		return fmt.Errorf("get mp payment info: %w", err)
	}

	// Find payment record by external_reference (order_id)
	payments, err := s.findPaymentByExternalRef(ctx, mpInfo.ExternalReference)
	if err != nil {
		return fmt.Errorf("find payment by external ref: %w", err)
	}
	if payments == nil {
		// Payment not found — maybe initiated outside our system
		return nil
	}

	// Map MP status to our statuses
	var paymentStatus string
	var orderStatus string
	var paidAt *time.Time

	switch mpInfo.Status {
	case "approved":
		paymentStatus = model.PaymentStatusApproved
		orderStatus = model.OrderStatusConfirmed
		now := time.Now()
		paidAt = &now
	case "rejected", "cancelled":
		paymentStatus = model.PaymentStatusRejected
		orderStatus = model.OrderStatusPending
		paidAt = nil
	case "refunded":
		paymentStatus = model.PaymentStatusRefunded
		orderStatus = model.OrderStatusConfirmed // order stays confirmed, just payment refunded
		paidAt = nil
	default:
		// "pending" or "in_process" — leave as-is
		return nil
	}

	// Update payment record
	if err := s.paymentRepo.UpdateStatus(ctx, payments.ID, paymentStatus, paidAt); err != nil {
		return fmt.Errorf("update payment status: %w", err)
	}

	if payments.OrderID != uuid.Nil {
		// Update order statuses
		if err := s.orderRepo.UpdatePaymentInfo(ctx, payments.OrderID, mapMpPaymentStatus(paymentStatus), orderStatus); err != nil {
			return fmt.Errorf("update order payment info: %w", err)
		}
	}

	return nil
}

// mapMpPaymentStatus converts our payment status to the order's payment_status enum.
// Both use the same values ("paid", "failed", "refunded"), just with different naming in the enum.
// The order's payment_status enum values are: 'pending', 'paid', 'failed', 'refunded'.
func mapMpPaymentStatus(status string) string {
	switch status {
	case model.PaymentStatusApproved:
		return model.PaymentStatusPaid
	case model.PaymentStatusRejected:
		return model.PaymentStatusFailed
	case model.PaymentStatusRefunded:
		return model.PaymentStatusRefunded
	default:
		return model.PaymentStatusPending
	}
}

// findPaymentByExternalRef finds a payment record by external_reference (order ID).
func (s *PaymentService) findPaymentByExternalRef(ctx context.Context, extRef string) (*model.Payment, error) {
	if extRef == "" {
		return nil, nil
	}
	orderID, err := uuid.Parse(extRef)
	if err != nil {
		return nil, nil
	}
	payment, err := s.paymentRepo.FindByOrderID(ctx, orderID)
	if err != nil {
		if errors.Is(err, model.ErrNotFound) {
			return nil, nil
		}
		return nil, err
	}
	return payment, nil
}

// ConfirmCashPayment marks a cash payment as paid by an admin.
//
// Validates that:
//   - The order exists
//   - The payment method is "cash"
//   - The payment is still pending
//
// On success, updates both the payment record and the order statuses.
func (s *PaymentService) ConfirmCashPayment(ctx context.Context, orderID uuid.UUID) error {
	// Find payment record
	payment, err := s.paymentRepo.FindByOrderID(ctx, orderID)
	if err != nil {
		return err
	}

	if payment.Method != model.PaymentMethodCash {
		return model.ErrNotCashPayment
	}

	if payment.Status != model.PaymentStatusPending {
		return model.ErrOrderAlreadyPaid
	}

	// Update payment
	now := time.Now()
	if err := s.paymentRepo.UpdateStatus(ctx, payment.ID, model.PaymentStatusApproved, &now); err != nil {
		return fmt.Errorf("update payment status: %w", err)
	}

	// Update order
	if err := s.orderRepo.UpdatePaymentInfo(ctx, orderID, model.PaymentStatusPaid, model.OrderStatusConfirmed); err != nil {
		return fmt.Errorf("update order payment info: %w", err)
	}

	return nil
}

// strPtr returns a pointer to the given string.
func strPtr(s string) *string {
	return &s
}
