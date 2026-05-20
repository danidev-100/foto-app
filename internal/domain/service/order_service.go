package service

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/shopspring/decimal"

	"foto-app/internal/domain/model"
	"foto-app/internal/domain/port"
)

// ---------- Request types ----------

// PlaceOrderRequest carries the fields needed to place an order from the cart.
type PlaceOrderRequest struct {
	PaymentMethod string `json:"payment_method"`
}

// UpdateOrderStatusRequest carries the new status for admin status updates.
type UpdateOrderStatusRequest struct {
	Status string `json:"status"`
}

// ---------- Response types ----------

// OrderDetailResponse combines an order with its items.
type OrderDetailResponse struct {
	Order *model.Order     `json:"order"`
	Items []model.OrderItem `json:"items"`
}

// ---------- Order Service ----------

// OrderService implements business logic for the order domain.
// It manages SERIALIZABLE transactions for order placement and cancellation
// that span multiple aggregates (cart, order, booklet stock).
type OrderService struct {
	pool       *pgxpool.Pool
	orderRepo  port.OrderRepository
	cartRepo   port.CartRepository
	bookletRepo port.BookletRepository
}

// NewOrderService creates an OrderService with its dependencies.
// The pgxpool.Pool is needed for SERIALIZABLE transaction management
// that spans cart, order, and booklet aggregates.
func NewOrderService(
	pool *pgxpool.Pool,
	orderRepo port.OrderRepository,
	cartRepo port.CartRepository,
	bookletRepo port.BookletRepository,
) *OrderService {
	return &OrderService{
		pool:        pool,
		orderRepo:   orderRepo,
		cartRepo:    cartRepo,
		bookletRepo: bookletRepo,
	}
}

// PlaceOrder creates an order from the student's current cart within a
// SERIALIZABLE transaction. It atomically:
//  1. Locks and reads the cart (SELECT FOR UPDATE)
//  2. Locks and reads cart items (SELECT FOR UPDATE)
//  3. Validates stock for each item against booklets (SELECT FOR UPDATE)
//  4. Creates the order and order_items with snapshotted prices
//  5. Decrements booklet stock atomically (stock >= quantity guard)
//  6. Clears all cart items
//  7. Computes delivery_date = NOW() + MAX(delivery_days)
//
// Returns model.ErrEmptyCart if the cart is empty.
// Returns model.ErrInsufficientStock if any item exceeds available stock.
func (s *OrderService) PlaceOrder(ctx context.Context, studentID uuid.UUID, req PlaceOrderRequest) (*model.Order, error) {
	if req.PaymentMethod != model.PaymentMethodMercadoPago && req.PaymentMethod != model.PaymentMethodCash {
		return nil, model.ErrInvalidPayment
	}

	// ── Begin SERIALIZABLE transaction ──────────────────────────────
	tx, err := s.pool.BeginTx(ctx, pgx.TxOptions{IsoLevel: pgx.Serializable})
	if err != nil {
		return nil, fmt.Errorf("begin tx: %w", err)
	}
	defer tx.Rollback(ctx) // no-op after commit

	// 1. Lock and read the student's cart
	var cartID uuid.UUID
	err = tx.QueryRow(ctx,
		`SELECT id FROM carts WHERE student_id = $1 FOR UPDATE`, studentID,
	).Scan(&cartID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, model.ErrEmptyCart
		}
		return nil, fmt.Errorf("find cart: %w", err)
	}

	// 2. Lock and read cart items
	rows, err := tx.Query(ctx, `
		SELECT ci.booklet_id, ci.quantity, ci.unit_price, ci.title, ci.delivery_days
		FROM cart_items ci
		WHERE ci.cart_id = $1
		ORDER BY ci.created_at
		FOR UPDATE
	`, cartID)
	if err != nil {
		return nil, fmt.Errorf("get cart items: %w", err)
	}

	type itemSnapshot struct {
		BookletID    uuid.UUID
		Quantity     int
		UnitPrice    decimal.Decimal
		Title        string
		DeliveryDays *int
	}

	var cartItems []itemSnapshot
	for rows.Next() {
		var item itemSnapshot
		if err := rows.Scan(&item.BookletID, &item.Quantity, &item.UnitPrice, &item.Title, &item.DeliveryDays); err != nil {
			rows.Close()
			return nil, fmt.Errorf("scan cart item: %w", err)
		}
		cartItems = append(cartItems, item)
	}
	rows.Close()
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("cart items iteration: %w", err)
	}

	if len(cartItems) == 0 {
		return nil, model.ErrEmptyCart
	}

	// 3. Validate stock for each item and compute total + delivery
	total := decimal.Zero
	maxDeliveryDays := 0
	hasDeliveryDays := false

	for _, item := range cartItems {
		var stock int
		var isActive bool
		err := tx.QueryRow(ctx, `
			SELECT stock, is_active FROM booklets WHERE id = $1 FOR UPDATE
		`, item.BookletID).Scan(&stock, &isActive)
		if err != nil {
			if errors.Is(err, pgx.ErrNoRows) {
				return nil, model.ErrBookletNotFound
			}
			return nil, fmt.Errorf("lock booklet %s: %w", item.BookletID, err)
		}
		if !isActive {
			return nil, model.ErrInsufficientStock
		}
		if stock < item.Quantity {
			return nil, model.ErrInsufficientStock
		}

		lineTotal := item.UnitPrice.Mul(decimal.NewFromInt(int64(item.Quantity)))
		total = total.Add(lineTotal)

		if item.DeliveryDays != nil && *item.DeliveryDays > maxDeliveryDays {
			maxDeliveryDays = *item.DeliveryDays
			hasDeliveryDays = true
		}
	}

	// 4. Calculate delivery date
	var deliveryDate *time.Time
	if hasDeliveryDays && maxDeliveryDays > 0 {
		d := time.Now().Add(time.Duration(maxDeliveryDays) * 24 * time.Hour)
		deliveryDate = &d
	}

	// 5. Create the order
	order := &model.Order{
		ID:            uuid.New(),
		StudentID:     studentID,
		Total:         total,
		Status:        model.OrderStatusPending,
		PaymentMethod: req.PaymentMethod,
		PaymentStatus: model.PaymentStatusPending,
		DeliveryDate:  deliveryDate,
	}

	_, err = tx.Exec(ctx, `
		INSERT INTO orders (id, student_id, total, status, payment_method, payment_status, delivery_date)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
	`, order.ID, order.StudentID, order.Total, order.Status, order.PaymentMethod, order.PaymentStatus, order.DeliveryDate)
	if err != nil {
		return nil, fmt.Errorf("insert order: %w", err)
	}

	// 6. Create order items and atomically decrement stock
	for _, item := range cartItems {
		_, err = tx.Exec(ctx, `
			INSERT INTO order_items (id, order_id, booklet_id, title, quantity, unit_price, delivery_days)
			VALUES ($1, $2, $3, $4, $5, $6, $7)
		`, uuid.New(), order.ID, item.BookletID, item.Title, item.Quantity, item.UnitPrice, item.DeliveryDays)
		if err != nil {
			return nil, fmt.Errorf("insert order_item: %w", err)
		}

		// Atomic stock decrement — guarded by WHERE stock >= quantity
		tag, err := tx.Exec(ctx, `
			UPDATE booklets SET stock = stock - $1 WHERE id = $2 AND stock >= $1
		`, item.Quantity, item.BookletID)
		if err != nil {
			return nil, fmt.Errorf("decrement stock: %w", err)
		}
		if tag.RowsAffected() == 0 {
			// Should not happen since we validated above, but guard against race
			return nil, model.ErrInsufficientStock
		}
	}

	// 7. Clear cart items
	_, err = tx.Exec(ctx, `DELETE FROM cart_items WHERE cart_id = $1`, cartID)
	if err != nil {
		return nil, fmt.Errorf("clear cart: %w", err)
	}

	// 8. Commit
	if err := tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("commit order tx: %w", err)
	}

	return order, nil
}

// ListOrders returns the student's orders with their items, paginated.
func (s *OrderService) ListOrders(ctx context.Context, studentID uuid.UUID, page, limit int) ([]OrderDetailResponse, int, error) {
	if page < 1 {
		page = 1
	}
	if limit < 1 || limit > 50 {
		limit = 10
	}

	orders, total, err := s.orderRepo.ListByStudent(ctx, studentID, page, limit)
	if err != nil {
		return nil, 0, err
	}

	if len(orders) == 0 {
		return []OrderDetailResponse{}, 0, nil
	}

	// Batch load items for all orders
	orderIDs := make([]uuid.UUID, len(orders))
	for i, o := range orders {
		orderIDs[i] = o.ID
	}

	itemsMap, err := s.orderRepo.FindItemsByOrderIDs(ctx, orderIDs)
	if err != nil {
		return nil, 0, err
	}

	// Combine orders with their items
	result := make([]OrderDetailResponse, len(orders))
	for i, o := range orders {
		result[i] = OrderDetailResponse{
			Order: &o,
			Items: itemsMap[o.ID],
		}
	}

	return result, total, nil
}

// GetOrder returns a single order with its items, scoped to the student.
func (s *OrderService) GetOrder(ctx context.Context, studentID uuid.UUID, orderID uuid.UUID) (*OrderDetailResponse, error) {
	order, err := s.orderRepo.FindByID(ctx, orderID)
	if err != nil {
		return nil, err
	}
	if order.StudentID != studentID {
		return nil, model.ErrNotFound
	}

	items, err := s.orderRepo.FindItemsByOrderID(ctx, orderID)
	if err != nil {
		return nil, err
	}

	return &OrderDetailResponse{
		Order: order,
		Items: items,
	}, nil
}

// GetOrderByID returns a single order with its items (admin — no student scoping).
func (s *OrderService) GetOrderByID(ctx context.Context, orderID uuid.UUID) (*OrderDetailResponse, error) {
	order, err := s.orderRepo.FindByID(ctx, orderID)
	if err != nil {
		return nil, err
	}

	items, err := s.orderRepo.FindItemsByOrderID(ctx, orderID)
	if err != nil {
		return nil, err
	}

	return &OrderDetailResponse{
		Order: order,
		Items: items,
	}, nil
}

// CancelOrder cancels a pending or confirmed order and restores stock.
// It uses a transaction to atomically:
//  1. Lock the order row (SELECT FOR UPDATE)
//  2. Verify the order is still in a cancellable state
//  3. Restore booklet stock for each item
//  4. Update order status to cancelled
//
// Returns model.ErrOrderNotCancellable if the order status doesn't allow cancellation.
func (s *OrderService) CancelOrder(ctx context.Context, studentID uuid.UUID, orderID uuid.UUID) (*model.Order, error) {
	// Pre-check: verify ownership and current status
	order, err := s.orderRepo.FindByID(ctx, orderID)
	if err != nil {
		return nil, err
	}
	if order.StudentID != studentID {
		return nil, model.ErrNotFound
	}
	if !order.IsCancellable() {
		return nil, model.ErrOrderNotCancellable
	}

	// Read order items for stock restoration
	items, err := s.orderRepo.FindItemsByOrderID(ctx, orderID)
	if err != nil {
		return nil, err
	}

	// ── Begin transaction ───────────────────────────────────────────
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return nil, fmt.Errorf("begin tx: %w", err)
	}
	defer tx.Rollback(ctx)

	// Re-check status under lock (prevent concurrent status changes)
	var currentStatus string
	err = tx.QueryRow(ctx,
		`SELECT status FROM orders WHERE id = $1 FOR UPDATE`, orderID,
	).Scan(&currentStatus)
	if err != nil {
		return nil, fmt.Errorf("lock order: %w", err)
	}
	if currentStatus != model.OrderStatusPending && currentStatus != model.OrderStatusConfirmed {
		return nil, model.ErrOrderNotCancellable
	}

	// Restore stock for each item
	for _, item := range items {
		_, err = tx.Exec(ctx, `UPDATE booklets SET stock = stock + $1 WHERE id = $2`,
			item.Quantity, item.BookletID)
		if err != nil {
			return nil, fmt.Errorf("restore stock for %s: %w", item.BookletID, err)
		}
	}

	// Update order status
	result, err := tx.Exec(ctx, `UPDATE orders SET status = $1, updated_at = NOW() WHERE id = $2`,
		model.OrderStatusCancelled, orderID)
	if err != nil {
		return nil, fmt.Errorf("update order status: %w", err)
	}
	if result.RowsAffected() == 0 {
		return nil, model.ErrNotFound
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("commit cancel tx: %w", err)
	}

	order.Status = model.OrderStatusCancelled
	return order, nil
}

// AdminListOrders returns all orders with pagination, optionally filtered by status.
func (s *OrderService) AdminListOrders(ctx context.Context, status string, page, limit int) ([]model.Order, int, error) {
	if page < 1 {
		page = 1
	}
	if limit < 1 || limit > 50 {
		limit = 10
	}
	return s.orderRepo.ListAll(ctx, status, page, limit)
}

// AdminListOrdersWithDetails returns all orders with student names and items, optionally filtered by status.
func (s *OrderService) AdminListOrdersWithDetails(ctx context.Context, status string, page, limit int) ([]OrderDetailResponse, map[uuid.UUID]string, int, error) {
	if page < 1 {
		page = 1
	}
	if limit < 1 || limit > 50 {
		limit = 10
	}

	orders, studentNames, total, err := s.orderRepo.ListAllWithStudentName(ctx, status, page, limit)
	if err != nil {
		return nil, nil, 0, err
	}

	if len(orders) == 0 {
		return []OrderDetailResponse{}, studentNames, 0, nil
	}

	// Batch load items for all orders
	orderIDs := make([]uuid.UUID, len(orders))
	for i, o := range orders {
		orderIDs[i] = o.ID
	}

	itemsMap, err := s.orderRepo.FindItemsByOrderIDs(ctx, orderIDs)
	if err != nil {
		return nil, nil, 0, err
	}

	// Combine orders with their items
	result := make([]OrderDetailResponse, len(orders))
	for i, o := range orders {
		result[i] = OrderDetailResponse{
			Order: &o,
			Items: itemsMap[o.ID],
		}
	}

	return result, studentNames, total, nil
}

// AdminUpdateOrderStatus updates the status of any order.
func (s *OrderService) AdminUpdateOrderStatus(ctx context.Context, orderID uuid.UUID, status string) error {
	return s.orderRepo.UpdateStatus(ctx, orderID, status)
}

// AdminSearchOrderByID searches for a single order by its ID.
func (s *OrderService) AdminSearchOrderByID(ctx context.Context, orderID uuid.UUID) (*OrderDetailResponse, string, error) {
	order, studentName, items, err := s.orderRepo.SearchByOrderID(ctx, orderID)
	if err != nil {
		return nil, "", err
	}
	if order == nil {
		return nil, "", nil
	}
	return &OrderDetailResponse{Order: order, Items: items}, studentName, nil
}

// AdminSearchOrdersByStudentName searches for all orders matching a student name.
func (s *OrderService) AdminSearchOrdersByStudentName(ctx context.Context, name string) ([]OrderDetailResponse, map[uuid.UUID]string, map[uuid.UUID][]model.OrderItem, error) {
	orders, studentNames, itemsMap, err := s.orderRepo.SearchByStudentName(ctx, name)
	if err != nil {
		return nil, nil, nil, err
	}

	result := make([]OrderDetailResponse, len(orders))
	for i, o := range orders {
		result[i] = OrderDetailResponse{
			Order: &o,
			Items: itemsMap[o.ID],
		}
	}

	return result, studentNames, itemsMap, nil
}

// AdminSearchOrdersByBookletTitle searches for orders containing a specific booklet.
func (s *OrderService) AdminSearchOrdersByBookletTitle(ctx context.Context, title string) ([]model.BookletOrderResult, error) {
	return s.orderRepo.SearchByBookletTitle(ctx, title)
}
