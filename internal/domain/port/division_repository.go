package port

import (
	"context"

	"github.com/google/uuid"

	"foto-app/internal/domain/model"
)

// DivisionRepository defines persistence operations for Division entities.
type DivisionRepository interface {
	FindByID(ctx context.Context, id uuid.UUID) (*model.Division, error)
	ListByCourse(ctx context.Context, courseID uuid.UUID) ([]model.Division, error)
	Create(ctx context.Context, d *model.Division) error
	Update(ctx context.Context, d *model.Division) error
	Delete(ctx context.Context, id uuid.UUID) error
}
