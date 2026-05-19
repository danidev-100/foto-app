package handler

import (
	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"

	"foto-app/internal/domain/model"
	"foto-app/internal/domain/service"
	"foto-app/pkg/response"
)

// PaymentHandler exposes HTTP endpoints for payment operations.
// Student-facing endpoints require AuthMiddleware.
// Admin endpoints require AuthMiddleware + AdminMiddleware.
// The webhook endpoint is intentionally unauthenticated (MP IPN).
type PaymentHandler struct {
	paymentService *service.PaymentService
}

// NewPaymentHandler creates a PaymentHandler with its service dependency.
func NewPaymentHandler(paymentService *service.PaymentService) *PaymentHandler {
	return &PaymentHandler{paymentService: paymentService}
}

// ---------- Student-facing endpoints ----------

// InitiatePayment handles POST /api/orders/:id/pay.
// Starts the payment flow for an order using the specified method.
// Request body: { "method": "mercadopago" | "cash" }
// For MP: returns payment_url (init_point) for redirect to MP Checkout Pro.
// For cash: returns success with pending payment.
func (h *PaymentHandler) InitiatePayment(c *fiber.Ctx) error {
	studentID := getStudentID(c)
	if studentID == uuid.Nil {
		return response.ErrorJSON(c, fiber.StatusUnauthorized, "AUTH_001", "authentication required", nil)
	}

	orderID, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return response.ErrorJSON(c, fiber.StatusBadRequest, "AUTH_004", "invalid order ID", nil)
	}

	var req struct {
		Method string `json:"method"`
	}
	if err := c.BodyParser(&req); err != nil {
		return response.ErrorJSON(c, fiber.StatusBadRequest, "AUTH_004", "invalid request body", nil)
	}

	if req.Method == "" {
		return response.ErrorJSON(c, fiber.StatusBadRequest, "AUTH_004", "method is required (mercadopago or cash)", nil)
	}

	result, err := h.paymentService.InitiatePayment(c.Context(), studentID, orderID, req.Method)
	if err != nil {
		switch err {
		case model.ErrNotFound:
			return response.ErrorJSON(c, fiber.StatusNotFound, "INF_001", "order not found", nil)
		case model.ErrInvalidPayment:
			return response.ErrorJSON(c, fiber.StatusBadRequest, "PAY_002", "invalid payment method for this order", nil)
		case model.ErrOrderAlreadyPaid:
			return response.ErrorJSON(c, fiber.StatusBadRequest, "PAY_003", "order already paid", nil)
		case model.ErrPaymentFailed:
			return response.ErrorJSON(c, fiber.StatusInternalServerError, "PAY_001", "payment processing failed", nil)
		default:
			return response.ErrorJSON(c, fiber.StatusInternalServerError, "INF_001", "internal server error", nil)
		}
	}

	return response.SuccessJSON(c, fiber.StatusCreated, result)
}

// ---------- Webhook (no auth) ----------

// HandleMPWebhook handles POST /api/webhooks/mercadopago.
// Receives Mercado Pago IPN (Instant Payment Notification) callbacks.
// NO authentication — validated by idempotency and body parsing.
// Always returns 200 to prevent MP retries.
func (h *PaymentHandler) HandleMPWebhook(c *fiber.Ctx) error {
	rawBody := c.Body()
	if len(rawBody) == 0 {
		// MP sends empty body for some events — return 200 silently
		return c.SendStatus(fiber.StatusOK)
	}

	if err := h.paymentService.HandleMPWebhook(c.Context(), rawBody); err != nil {
		// Log but always return 200 — MP retries on non-200
		_ = err
	}

	return c.SendStatus(fiber.StatusOK)
}

// ---------- Admin endpoints ----------

// ConfirmCashPayment handles POST /api/admin/orders/:id/pay-cash.
// Admin marks a cash payment as paid, confirming the order.
// Requires AuthMiddleware + AdminMiddleware.
func (h *PaymentHandler) ConfirmCashPayment(c *fiber.Ctx) error {
	orderID, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return response.ErrorJSON(c, fiber.StatusBadRequest, "AUTH_004", "invalid order ID", nil)
	}

	if err := h.paymentService.ConfirmCashPayment(c.Context(), orderID); err != nil {
		switch err {
		case model.ErrNotFound:
			return response.ErrorJSON(c, fiber.StatusNotFound, "INF_001", "order or payment not found", nil)
		case model.ErrNotCashPayment:
			return response.ErrorJSON(c, fiber.StatusBadRequest, "PAY_006", "payment method is not cash", nil)
		case model.ErrOrderAlreadyPaid:
			return response.ErrorJSON(c, fiber.StatusBadRequest, "PAY_003", "payment already processed", nil)
		default:
			return response.ErrorJSON(c, fiber.StatusInternalServerError, "INF_001", "internal server error", nil)
		}
	}

	return response.SuccessJSON(c, fiber.StatusOK, map[string]string{"message": "cash payment confirmed"})
}
