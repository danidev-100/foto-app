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

	// FindItemsByOrderIDs returns all items for the given order IDs.
	// Returns a map of orderID -> []OrderItem for efficient batch loading.
	FindItemsByOrderIDs(ctx context.Context, orderIDs []uuid.UUID) (map[uuid.UUID][]model.OrderItem, error)

	// ListByStudent returns paginated orders for a specific student, newest first.
	// Returns (orders, totalCount, error).
	ListByStudent(ctx context.Context, studentID uuid.UUID, page, limit int) ([]model.Order, int, error)

	// ListAll returns paginated orders for admin view, optionally filtered by status.
	// Pass an empty string for status to return all orders.
	// Returns (orders, totalCount, error).
	ListAll(ctx context.Context, status string, page, limit int) ([]model.Order, int, error)

	// ListAllWithStudentName returns paginated orders for admin view with student names.
	// Optionally filtered by status. Returns (orders, studentNames, totalCount, error).
	ListAllWithStudentName(ctx context.Context, status string, page, limit int) ([]model.Order, map[uuid.UUID]string, int, error)

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

	// SearchByOrderID returns a single order with student name and items.
	// Returns (nil, "", nil, nil) if not found.
	SearchByOrderID(ctx context.Context, orderID uuid.UUID) (*model.Order, string, []model.OrderItem, error)

	// SearchByStudentName returns all orders for students matching the given name (ILIKE).
	// Returns (orders, studentNames, itemsMap, error).
	SearchByStudentName(ctx context.Context, name string) ([]model.Order, map[uuid.UUID]string, map[uuid.UUID][]model.OrderItem, error)

	// SearchByBookletTitle returns orders containing items matching the booklet title (ILIKE).
	SearchByBookletTitle(ctx context.Context, title string) ([]model.BookletOrderResult, error)
}
