package repository

import (
	"context"
	"errors"
	"fmt"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"foto-app/internal/domain/model"
)

// OrderRepo implements port.OrderRepository using pgx.
type OrderRepo struct {
	pool *pgxpool.Pool
}

// NewOrderRepo creates a new pgx-backed OrderRepo.
func NewOrderRepo(pool *pgxpool.Pool) *OrderRepo {
	return &OrderRepo{pool: pool}
}

// Create persists a new order row.
func (r *OrderRepo) Create(ctx context.Context, o *model.Order) error {
	query := `INSERT INTO orders (id, student_id, total, status, payment_method, payment_status,
	           mp_preference_id, notes, delivery_date)
	           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`
	_, err := r.pool.Exec(ctx, query,
		o.ID, o.StudentID, o.Total, o.Status, o.PaymentMethod, o.PaymentStatus,
		o.MPPreferenceID, o.Notes, o.DeliveryDate,
	)
	if err != nil {
		return fmt.Errorf("insert order: %w", err)
	}
	return nil
}

// CreateItem persists a single order_item row.
func (r *OrderRepo) CreateItem(ctx context.Context, item *model.OrderItem) error {
	query := `INSERT INTO order_items (id, order_id, booklet_id, title, quantity, unit_price, delivery_days)
	           VALUES ($1, $2, $3, $4, $5, $6, $7)`
	_, err := r.pool.Exec(ctx, query,
		item.ID, item.OrderID, item.BookletID, item.Title, item.Quantity, item.UnitPrice, item.DeliveryDays,
	)
	if err != nil {
		return fmt.Errorf("insert order_item: %w", err)
	}
	return nil
}

// FindByID retrieves an order by its ID.
func (r *OrderRepo) FindByID(ctx context.Context, id uuid.UUID) (*model.Order, error) {
	query := `SELECT id, student_id, total, status, payment_method, payment_status,
	           mp_preference_id, notes, delivery_date, created_at, updated_at
	           FROM orders WHERE id = $1`
	row := r.pool.QueryRow(ctx, query, id)
	return scanOrder(row)
}

// FindItemsByOrderID returns all items for a given order.
func (r *OrderRepo) FindItemsByOrderID(ctx context.Context, orderID uuid.UUID) ([]model.OrderItem, error) {
	query := `SELECT id, order_id, booklet_id, title, quantity, unit_price, delivery_days, created_at
	           FROM order_items WHERE order_id = $1 ORDER BY created_at`
	rows, err := r.pool.Query(ctx, query, orderID)
	if err != nil {
		return nil, fmt.Errorf("query order_items: %w", err)
	}
	defer rows.Close()

	var items []model.OrderItem
	for rows.Next() {
		var item model.OrderItem
		err := rows.Scan(
			&item.ID, &item.OrderID, &item.BookletID, &item.Title,
			&item.Quantity, &item.UnitPrice, &item.DeliveryDays, &item.CreatedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("scan order_item: %w", err)
		}
		items = append(items, item)
	}
	if items == nil {
		items = []model.OrderItem{}
	}
	return items, rows.Err()
}

// ListByStudent returns paginated orders for a specific student.
func (r *OrderRepo) ListByStudent(ctx context.Context, studentID uuid.UUID, page, limit int) ([]model.Order, int, error) {
	offset := (page - 1) * limit

	// Total count
	var total int
	err := r.pool.QueryRow(ctx,
		`SELECT COUNT(*) FROM orders WHERE student_id = $1`, studentID,
	).Scan(&total)
	if err != nil {
		return nil, 0, fmt.Errorf("count orders: %w", err)
	}

	if total == 0 {
		return []model.Order{}, 0, nil
	}

	// Data page
	query := `SELECT id, student_id, total, status, payment_method, payment_status,
	           mp_preference_id, notes, delivery_date, created_at, updated_at
	           FROM orders WHERE student_id = $1
	           ORDER BY created_at DESC LIMIT $2 OFFSET $3`
	rows, err := r.pool.Query(ctx, query, studentID, limit, offset)
	if err != nil {
		return nil, 0, fmt.Errorf("query orders: %w", err)
	}
	defer rows.Close()

	orders, err := scanOrders(rows)
	if err != nil {
		return nil, 0, err
	}
	return orders, total, nil
}

// ListAll returns paginated orders for admin view.
func (r *OrderRepo) ListAll(ctx context.Context, status string, page, limit int) ([]model.Order, int, error) {
	offset := (page - 1) * limit

	var total int
	var countQuery string
	var dataQuery string
	var args []any

	if status != "" {
		countQuery = `SELECT COUNT(*) FROM orders WHERE status = $1`
		dataQuery = `SELECT id, student_id, total, status, payment_method, payment_status,
		              mp_preference_id, notes, delivery_date, created_at, updated_at
		              FROM orders WHERE status = $1
		              ORDER BY created_at DESC LIMIT $2 OFFSET $3`
		args = []any{status, limit, offset}

		err := r.pool.QueryRow(ctx, countQuery, status).Scan(&total)
		if err != nil {
			return nil, 0, fmt.Errorf("count orders: %w", err)
		}
	} else {
		countQuery = `SELECT COUNT(*) FROM orders`
		dataQuery = `SELECT id, student_id, total, status, payment_method, payment_status,
		              mp_preference_id, notes, delivery_date, created_at, updated_at
		              FROM orders ORDER BY created_at DESC LIMIT $1 OFFSET $2`

		err := r.pool.QueryRow(ctx, countQuery).Scan(&total)
		if err != nil {
			return nil, 0, fmt.Errorf("count orders: %w", err)
		}

		args = []any{limit, offset}
	}

	if total == 0 {
		return []model.Order{}, 0, nil
	}

	rows, err := r.pool.Query(ctx, dataQuery, args...)
	if err != nil {
		return nil, 0, fmt.Errorf("query all orders: %w", err)
	}
	defer rows.Close()

	orders, err := scanOrders(rows)
	if err != nil {
		return nil, 0, err
	}
	return orders, total, nil
}

// UpdateStatus changes the order's status and sets updated_at to NOW().
func (r *OrderRepo) UpdateStatus(ctx context.Context, id uuid.UUID, status string) error {
	query := `UPDATE orders SET status = $1, updated_at = NOW() WHERE id = $2`
	tag, err := r.pool.Exec(ctx, query, status, id)
	if err != nil {
		return fmt.Errorf("update order status: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return model.ErrNotFound
	}
	return nil
}

// UpdatePaymentInfo updates the order's payment_status and optionally the order status.
func (r *OrderRepo) UpdatePaymentInfo(ctx context.Context, id uuid.UUID, paymentStatus string, orderStatus string) error {
	query := `UPDATE orders SET payment_status = $1, status = $2, updated_at = NOW() WHERE id = $3`
	tag, err := r.pool.Exec(ctx, query, paymentStatus, orderStatus, id)
	if err != nil {
		return fmt.Errorf("update order payment info: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return model.ErrNotFound
	}
	return nil
}

// SetMPPreferenceID stores the Mercado Pago preference ID on the order.
func (r *OrderRepo) SetMPPreferenceID(ctx context.Context, id uuid.UUID, mpPreferenceID string) error {
	query := `UPDATE orders SET mp_preference_id = $1, updated_at = NOW() WHERE id = $2`
	tag, err := r.pool.Exec(ctx, query, mpPreferenceID, id)
	if err != nil {
		return fmt.Errorf("set mp_preference_id: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return model.ErrNotFound
	}
	return nil
}

// -- scan helpers --

func scanOrder(row pgx.Row) (*model.Order, error) {
	var o model.Order
	err := row.Scan(
		&o.ID, &o.StudentID, &o.Total, &o.Status, &o.PaymentMethod, &o.PaymentStatus,
		&o.MPPreferenceID, &o.Notes, &o.DeliveryDate, &o.CreatedAt, &o.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, model.ErrNotFound
		}
		return nil, fmt.Errorf("scan order: %w", err)
	}
	return &o, nil
}

func scanOrders(rows pgx.Rows) ([]model.Order, error) {
	var orders []model.Order
	for rows.Next() {
		var o model.Order
		err := rows.Scan(
			&o.ID, &o.StudentID, &o.Total, &o.Status, &o.PaymentMethod, &o.PaymentStatus,
			&o.MPPreferenceID, &o.Notes, &o.DeliveryDate, &o.CreatedAt, &o.UpdatedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("scan order: %w", err)
		}
		orders = append(orders, o)
	}
	if orders == nil {
		orders = []model.Order{}
	}
	return orders, rows.Err()
}
