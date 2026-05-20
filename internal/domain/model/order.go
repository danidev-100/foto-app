package model

import (
	"time"

	"github.com/google/uuid"
	"github.com/shopspring/decimal"
)

// Order status constants matching the order_status DB enum.
const (
	OrderStatusPending   = "pending"
	OrderStatusConfirmed = "confirmed"
	OrderStatusShipped   = "shipped"
	OrderStatusDelivered = "delivered"
	OrderStatusCancelled = "cancelled"
)

// Payment method constants matching the payment_method DB enum.
const (
	PaymentMethodMercadoPago = "mercadopago"
	PaymentMethodCash        = "cash"
)

// Payment status constants matching the payment_status DB enum.
const (
	PaymentStatusPending  = "pending"
	PaymentStatusPaid     = "paid"
	PaymentStatusFailed   = "failed"
	PaymentStatusRefunded = "refunded"
)

// Order represents a student's booklet order with pricing snapshotted at order time.
type Order struct {
	ID             uuid.UUID       `json:"id"`
	StudentID      uuid.UUID       `json:"student_id"`
	Total          decimal.Decimal `json:"total"`
	Status         string          `json:"status"`
	PaymentMethod  string          `json:"payment_method"`
	PaymentStatus  string          `json:"payment_status"`
	MPPreferenceID *string         `json:"mp_preference_id,omitempty"`
	Notes          *string         `json:"notes,omitempty"`
	DeliveryDate   *time.Time      `json:"delivery_date,omitempty"`
	CreatedAt      time.Time       `json:"created_at"`
	UpdatedAt      time.Time       `json:"updated_at"`
}

// IsCancellable returns true if the order can be cancelled.
func (o *Order) IsCancellable() bool {
	return o.Status == OrderStatusPending || o.Status == OrderStatusConfirmed
}

// BookletOrderResult represents a student's order containing a specific booklet.
type BookletOrderResult struct {
	StudentName  string `json:"student_name"`
	StudentID    string `json:"student_id"`
	OrderID      string `json:"order_id"`
	BookletTitle string `json:"booklet_title"`
	Quantity     int    `json:"quantity"`
	OrderStatus  string `json:"order_status"`
	CreatedAt    string `json:"created_at"`
}
