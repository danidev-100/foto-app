package model

import (
	"time"

	"github.com/google/uuid"
)

// Course represents a school course/year (e.g., "1st Year", "2nd Year").
type Course struct {
	ID          uuid.UUID `json:"id"`
	Name        string    `json:"name"`
	Description *string   `json:"description,omitempty"`
	IsActive    bool      `json:"is_active"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}
