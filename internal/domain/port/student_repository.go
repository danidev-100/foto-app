package port

import (
	"context"

	"github.com/google/uuid"

	"foto-app/internal/domain/model"
)

// StudentRepository defines the persistence contract for Student entities.
type StudentRepository interface {
	// Create persists a new student. Returns model.ErrConflict if email already exists.
	Create(ctx context.Context, s *model.Student) error

	// FindByEmail looks up a student by email. Returns model.ErrNotFound if not found.
	FindByEmail(ctx context.Context, email string) (*model.Student, error)

	// FindByID looks up a student by primary key. Returns model.ErrNotFound if not found.
	FindByID(ctx context.Context, id uuid.UUID) (*model.Student, error)

	// FindAll returns a paginated list of students and the total count.
	FindAll(ctx context.Context, page, limit int) ([]*model.Student, int, error)

	// Update persists changes to an existing student.
	Update(ctx context.Context, s *model.Student) error
}
