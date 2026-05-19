package model

import (
	"time"

	"github.com/google/uuid"
)

// Cart represents a shopping cart owned by a student.
// Each student has exactly one cart (UNIQUE constraint on student_id).
type Cart struct {
	ID        uuid.UUID `json:"id"`
	StudentID uuid.UUID `json:"student_id"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}
