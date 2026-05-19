package model

import (
	"time"

	"github.com/google/uuid"
	"github.com/shopspring/decimal"
)

// CartItem represents a single line item in a shopping cart.
// UnitPrice, Title, ColorType, and DeliveryDays are snapshotted
// from the booklet at add-time so the cart is consistent even if
// the booklet's price or details change later.
type CartItem struct {
	ID            uuid.UUID       `json:"id"`
	CartID        uuid.UUID       `json:"cart_id"`
	BookletID     uuid.UUID       `json:"booklet_id"`
	Quantity      int             `json:"quantity"`
	UnitPrice     decimal.Decimal `json:"unit_price"`
	Title         string          `json:"title"`
	ColorType     *string         `json:"color_type,omitempty"`
	DeliveryDays  *int            `json:"delivery_days,omitempty"`
	CreatedAt     time.Time       `json:"created_at"`
	UpdatedAt     time.Time       `json:"updated_at"`
}
