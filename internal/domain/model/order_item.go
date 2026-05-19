package model

import (
	"time"

	"github.com/google/uuid"
	"github.com/shopspring/decimal"
)

// OrderItem represents a single line item snapshot within an order.
// Fields like Title, UnitPrice, and DeliveryDays are snapshotted from
// the booklet at order time to preserve consistency.
type OrderItem struct {
	ID           uuid.UUID       `json:"id"`
	OrderID      uuid.UUID       `json:"order_id"`
	BookletID    uuid.UUID       `json:"booklet_id"`
	Title        string          `json:"title"`
	Quantity     int             `json:"quantity"`
	UnitPrice    decimal.Decimal `json:"unit_price"`
	DeliveryDays *int            `json:"delivery_days,omitempty"`
	CreatedAt    time.Time       `json:"created_at"`
}
