package port

import (
	"context"

	"github.com/google/uuid"

	"foto-app/internal/domain/model"
)

// CourseRepository defines persistence operations for Course entities.
type CourseRepository interface {
	FindByID(ctx context.Context, id uuid.UUID) (*model.Course, error)
	List(ctx context.Context) ([]model.Course, error)
	Create(ctx context.Context, c *model.Course) error
	Update(ctx context.Context, c *model.Course) error
	Delete(ctx context.Context, id uuid.UUID) error
}
