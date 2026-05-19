package port

import (
	"context"

	"github.com/google/uuid"

	"foto-app/internal/domain/model"
)

// BookletFilter carries optional query parameters for listing booklets.
type BookletFilter struct {
	CourseID   *uuid.UUID
	DivisionID *uuid.UUID
	Page       int // default 1
	Limit      int // default 20
	AdminView  bool // if true, include inactive and out-of-stock
}

// BookletRepository defines persistence operations for Booklet entities.
type BookletRepository interface {
	FindByID(ctx context.Context, id uuid.UUID) (*model.Booklet, error)
	List(ctx context.Context, filter BookletFilter) ([]model.Booklet, int, error)
	ListByCourse(ctx context.Context, courseID uuid.UUID) ([]model.Booklet, error)
	ListActiveByCourse(ctx context.Context, courseID uuid.UUID) ([]model.Booklet, error)
	Create(ctx context.Context, b *model.Booklet) error
	Update(ctx context.Context, b *model.Booklet) error
	Delete(ctx context.Context, id uuid.UUID) error
	UpdateStock(ctx context.Context, id uuid.UUID, stock int) error
}
