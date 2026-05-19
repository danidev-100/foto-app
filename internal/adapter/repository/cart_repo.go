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

// CartRepo implements port.CartRepository using pgx.
type CartRepo struct {
	pool *pgxpool.Pool
}

// NewCartRepo creates a new pgx-backed CartRepo.
func NewCartRepo(pool *pgxpool.Pool) *CartRepo {
	return &CartRepo{pool: pool}
}

// FindByStudentID retrieves the cart for a given student.
// Returns model.ErrNotFound if the student has no cart yet.
func (r *CartRepo) FindByStudentID(ctx context.Context, studentID uuid.UUID) (*model.Cart, error) {
	query := `SELECT id, student_id, created_at, updated_at FROM carts WHERE student_id = $1`
	row := r.pool.QueryRow(ctx, query, studentID)
	return scanCart(row)
}

// Create inserts a new cart row for the student.
func (r *CartRepo) Create(ctx context.Context, cart *model.Cart) error {
	query := `INSERT INTO carts (id, student_id) VALUES ($1, $2)`
	_, err := r.pool.Exec(ctx, query, cart.ID, cart.StudentID)
	if err != nil {
		return fmt.Errorf("insert cart: %w", err)
	}
	return nil
}

// AddItem inserts a new cart_item row.
func (r *CartRepo) AddItem(ctx context.Context, item *model.CartItem) error {
	query := `INSERT INTO cart_items (id, cart_id, booklet_id, quantity, unit_price, title, color_type, delivery_days)
	           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`
	_, err := r.pool.Exec(ctx, query,
		item.ID, item.CartID, item.BookletID, item.Quantity,
		item.UnitPrice, item.Title, item.ColorType, item.DeliveryDays,
	)
	if err != nil {
		return fmt.Errorf("insert cart_item: %w", err)
	}
	return nil
}

// UpdateItem changes the quantity for a given booklet in the cart.
func (r *CartRepo) UpdateItem(ctx context.Context, cartID, bookletID uuid.UUID, quantity int) error {
	query := `UPDATE cart_items SET quantity = $3, updated_at = NOW()
	           WHERE cart_id = $1 AND booklet_id = $2`
	tag, err := r.pool.Exec(ctx, query, cartID, bookletID, quantity)
	if err != nil {
		return fmt.Errorf("update cart_item quantity: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return model.ErrNotFound
	}
	return nil
}

// RemoveItem deletes a specific cart_item by booklet.
func (r *CartRepo) RemoveItem(ctx context.Context, cartID, bookletID uuid.UUID) error {
	query := `DELETE FROM cart_items WHERE cart_id = $1 AND booklet_id = $2`
	tag, err := r.pool.Exec(ctx, query, cartID, bookletID)
	if err != nil {
		return fmt.Errorf("delete cart_item: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return model.ErrNotFound
	}
	return nil
}

// Clear deletes all cart_items for the given cart.
func (r *CartRepo) Clear(ctx context.Context, cartID uuid.UUID) error {
	query := `DELETE FROM cart_items WHERE cart_id = $1`
	_, err := r.pool.Exec(ctx, query, cartID)
	if err != nil {
		return fmt.Errorf("clear cart_items: %w", err)
	}
	return nil
}

// GetItems returns all items in a cart, ordered by created_at.
func (r *CartRepo) GetItems(ctx context.Context, cartID uuid.UUID) ([]model.CartItem, error) {
	query := `SELECT id, cart_id, booklet_id, quantity, unit_price, title, color_type, delivery_days, created_at, updated_at
	           FROM cart_items WHERE cart_id = $1 ORDER BY created_at`
	rows, err := r.pool.Query(ctx, query, cartID)
	if err != nil {
		return nil, fmt.Errorf("get cart_items: %w", err)
	}
	defer rows.Close()

	var items []model.CartItem
	for rows.Next() {
		var item model.CartItem
		err := rows.Scan(
			&item.ID, &item.CartID, &item.BookletID, &item.Quantity,
			&item.UnitPrice, &item.Title, &item.ColorType, &item.DeliveryDays,
			&item.CreatedAt, &item.UpdatedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("scan cart_item: %w", err)
		}
		items = append(items, item)
	}
	if items == nil {
		items = []model.CartItem{}
	}
	return items, rows.Err()
}

// -- scan helpers --

func scanCart(row pgx.Row) (*model.Cart, error) {
	var c model.Cart
	err := row.Scan(&c.ID, &c.StudentID, &c.CreatedAt, &c.UpdatedAt)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, model.ErrNotFound
		}
		return nil, fmt.Errorf("scan cart: %w", err)
	}
	return &c, nil
}
