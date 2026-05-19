package port

import (
	"context"

	"github.com/google/uuid"

	"foto-app/internal/domain/model"
)

// CartRepository defines persistence operations for the Cart aggregate.
type CartRepository interface {
	// FindByStudentID retrieves the cart for a given student.
	// Returns model.ErrNotFound if the student has no cart yet.
	FindByStudentID(ctx context.Context, studentID uuid.UUID) (*model.Cart, error)

	// Create inserts a new cart row for the student.
	Create(ctx context.Context, cart *model.Cart) error

	// AddItem inserts a new cart_item row.
	// Returns model.ErrConflict if the booklet is already in the cart (caller should upsert).
	AddItem(ctx context.Context, item *model.CartItem) error

	// UpdateItem changes the quantity for a given booklet in the cart.
	// Returns model.ErrNotFound if the item is not in the cart.
	UpdateItem(ctx context.Context, cartID, bookletID uuid.UUID, quantity int) error

	// RemoveItem deletes a specific cart_item by booklet.
	// Returns model.ErrNotFound if the item is not in the cart.
	RemoveItem(ctx context.Context, cartID, bookletID uuid.UUID) error

	// Clear deletes all cart_items for the given cart.
	Clear(ctx context.Context, cartID uuid.UUID) error

	// GetItems returns all items in a cart, ordered by created_at.
	GetItems(ctx context.Context, cartID uuid.UUID) ([]model.CartItem, error)
}
