package model

import (
	"encoding/json"
	"time"

	"github.com/google/uuid"
)

// PaymentEvent represents a Mercado Pago webhook notification.
// The event_id maps to MP's notification ID and is UNIQUE in the DB,
// providing idempotent webhook processing.
type PaymentEvent struct {
	ID          uuid.UUID        `json:"id"`
	OrderID     uuid.UUID        `json:"order_id"`
	EventID     string           `json:"event_id"`
	Topic       string           `json:"topic"`
	Action      string           `json:"action"`
	MPPaymentID *string          `json:"mp_payment_id,omitempty"`
	RawBody     json.RawMessage  `json:"raw_body,omitempty"`
	Processed   bool             `json:"processed"`
	ProcessedAt *time.Time       `json:"processed_at,omitempty"`
	CreatedAt   time.Time        `json:"created_at"`
}
