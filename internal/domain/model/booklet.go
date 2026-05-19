package model

import (
	"time"

	"github.com/google/uuid"
	"github.com/shopspring/decimal"
)

// Booklet represents a photocopied booklet available for ordering.
// ColorType and DeliveryDays are not yet in the schema — they belong in a future migration.
type Booklet struct {
	ID           uuid.UUID       `json:"id"`
	CourseID     uuid.UUID       `json:"course_id"`
	DivisionID   uuid.UUID       `json:"division_id"`
	Title        string          `json:"title"`
	Description  *string         `json:"description,omitempty"`
	CurrentPrice decimal.Decimal `json:"current_price"`
	Stock        int             `json:"stock"`
	ImageURL     *string         `json:"image_url,omitempty"`
	IsActive     bool            `json:"is_active"`
	CreatedAt    time.Time       `json:"created_at"`
	UpdatedAt    time.Time       `json:"updated_at"`
}
