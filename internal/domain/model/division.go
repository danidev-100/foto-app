package model

import (
	"time"

	"github.com/google/uuid"
)

// Division represents a school division/class within a course (e.g., "A", "B").
type Division struct {
	ID        uuid.UUID `json:"id"`
	CourseID  uuid.UUID `json:"course_id"`
	Name      string    `json:"name"`
	IsActive  bool      `json:"is_active"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}
