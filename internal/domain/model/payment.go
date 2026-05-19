package model

import (
	"time"

	"github.com/google/uuid"
	"github.com/shopspring/decimal"
)

// Payment status constants specific to the payment lifecycle.
// These complement the order-level PaymentStatus* constants in order.go
// with approved/rejected for gateway responses.
const (
	PaymentStatusApproved = "approved"
	PaymentStatusRejected = "rejected"
)

// Payment represents a single payment transaction for an order.
// For MP payments, MPPaymentID holds the MP payment ID returned after checkout.
// For cash payments, the flow is confirmed by an admin.
type Payment struct {
	ID                uuid.UUID       `json:"id"`
	OrderID           uuid.UUID       `json:"order_id"`
	Method            string          `json:"method"`
	Status            string          `json:"status"`
	Amount            decimal.Decimal `json:"amount"`
	MPPaymentID       *string         `json:"mp_payment_id,omitempty"`
	ExternalReference *string         `json:"external_reference,omitempty"`
	PaidAt            *time.Time      `json:"paid_at,omitempty"`
	CreatedAt         time.Time       `json:"created_at"`
	UpdatedAt         time.Time       `json:"updated_at"`
}
