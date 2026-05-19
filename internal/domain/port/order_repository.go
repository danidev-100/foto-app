package port

import (
	"context"

	"github.com/google/uuid"

	"foto-app/internal/domain/model"
)

// OrderRepository defines persistence operations for the Order aggregate.
type OrderRepository interface {
	// Create persists a new order.
	// For transactional creation (with items, stock update, and cart clear),
	// use OrderService.PlaceOrder which manages a SERIALIZABLE transaction directly.
	Create(ctx context.Context, o *model.Order) error

	// CreateItem persists a single order_item row.
	CreateItem(ctx context.Context, item *model.OrderItem) error

	// FindByID retrieves an order by its ID.
	// Returns model.ErrNotFound if not found.
	FindByID(ctx context.Context, id uuid.UUID) (*model.Order, error)

	// FindItemsByOrderID returns all items for a given order, ordered by created_at.
	FindItemsByOrderID(ctx context.Context, orderID uuid.UUID) ([]model.OrderItem, error)

	// ListByStudent returns paginated orders for a specific student, newest first.
	// Returns (orders, totalCount, error).
	ListByStudent(ctx context.Context, studentID uuid.UUID, page, limit int) ([]model.Order, int, error)

	// ListAll returns paginated orders for admin view, optionally filtered by status.
	// Pass an empty string for status to return all orders.
	// Returns (orders, totalCount, error).
	ListAll(ctx context.Context, status string, page, limit int) ([]model.Order, int, error)

	// UpdateStatus changes the order's status and sets updated_at to NOW().
	// Returns model.ErrNotFound if the order does not exist.
	UpdateStatus(ctx context.Context, id uuid.UUID, status string) error

	// UpdatePaymentInfo updates the order's payment_status and optionally the order status.
	// Used by the payment module when a payment is approved or refunded.
	// Returns model.ErrNotFound if the order does not exist.
	UpdatePaymentInfo(ctx context.Context, id uuid.UUID, paymentStatus string, orderStatus string) error

	// SetMPPreferenceID stores the Mercado Pago preference ID on the order.
	// Used after creating an MP preference for a pending order.
	// Returns model.ErrNotFound if the order does not exist.
	SetMPPreferenceID(ctx context.Context, id uuid.UUID, mpPreferenceID string) error
}
