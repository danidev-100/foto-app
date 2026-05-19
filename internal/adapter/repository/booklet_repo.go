package repository

import (
	"context"
	"errors"
	"fmt"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"foto-app/internal/domain/model"
	"foto-app/internal/domain/port"
)

// BookletRepo implements port.BookletRepository using pgx.
type BookletRepo struct {
	pool *pgxpool.Pool
}

// NewBookletRepo creates a new pgx-backed BookletRepo.
func NewBookletRepo(pool *pgxpool.Pool) *BookletRepo {
	return &BookletRepo{pool: pool}
}

// bookletColumns is the shared column list for SELECT queries.
const bookletColumns = `id, course_id, division_id, title, description, current_price, stock, image_url, is_active, created_at, updated_at`

// FindByID retrieves a booklet by primary key. Returns model.ErrNotFound if missing.
func (r *BookletRepo) FindByID(ctx context.Context, id uuid.UUID) (*model.Booklet, error) {
	query := `SELECT ` + bookletColumns + ` FROM booklets WHERE id = $1`
	row := r.pool.QueryRow(ctx, query, id)
	return scanBooklet(row)
}

// List returns booklets with optional filters and pagination.
// Returns the slice of booklets and the total count (without pagination).
func (r *BookletRepo) List(ctx context.Context, filter port.BookletFilter) ([]model.Booklet, int, error) {
	where := "WHERE 1=1"
	args := pgx.NamedArgs{}

	if filter.CourseID != nil {
		where += " AND course_id = @course_id"
		args["course_id"] = *filter.CourseID
	}
	if filter.DivisionID != nil {
		where += " AND division_id = @division_id"
		args["division_id"] = *filter.DivisionID
	}
	if !filter.AdminView {
		where += " AND is_active = true AND stock > 0"
	}

	// Count query
	countQuery := `SELECT COUNT(*) FROM booklets ` + where
	var total int
	if err := r.pool.QueryRow(ctx, countQuery, args).Scan(&total); err != nil {
		return nil, 0, fmt.Errorf("count booklets: %w", err)
	}

	// Data query with pagination
	page := filter.Page
	if page < 1 {
		page = 1
	}
	limit := filter.Limit
	if limit < 1 {
		limit = 20
	}
	offset := (page - 1) * limit

	args["limit"] = limit
	args["offset"] = offset

	dataQuery := `SELECT ` + bookletColumns + ` FROM booklets ` + where + ` ORDER BY title LIMIT @limit OFFSET @offset`

	rows, err := r.pool.Query(ctx, dataQuery, args)
	if err != nil {
		return nil, 0, fmt.Errorf("list booklets: %w", err)
	}
	defer rows.Close()

	var booklets []model.Booklet
	for rows.Next() {
		b, err := scanBookletFromRows(rows)
		if err != nil {
			return nil, 0, err
		}
		booklets = append(booklets, *b)
	}
	if booklets == nil {
		booklets = []model.Booklet{}
	}
	return booklets, total, rows.Err()
}

// ListByCourse returns all booklets for a given course (no active/stock filter).
func (r *BookletRepo) ListByCourse(ctx context.Context, courseID uuid.UUID) ([]model.Booklet, error) {
	query := `SELECT ` + bookletColumns + ` FROM booklets WHERE course_id = $1 ORDER BY title`
	rows, err := r.pool.Query(ctx, query, courseID)
	if err != nil {
		return nil, fmt.Errorf("list booklets by course: %w", err)
	}
	defer rows.Close()

	return collectBooklets(rows)
}

// ListActiveByCourse returns only active booklets with stock > 0 for a given course.
func (r *BookletRepo) ListActiveByCourse(ctx context.Context, courseID uuid.UUID) ([]model.Booklet, error) {
	query := `SELECT ` + bookletColumns + ` FROM booklets
	           WHERE course_id = $1 AND is_active = true AND stock > 0
	           ORDER BY title`
	rows, err := r.pool.Query(ctx, query, courseID)
	if err != nil {
		return nil, fmt.Errorf("list active booklets by course: %w", err)
	}
	defer rows.Close()

	return collectBooklets(rows)
}

// Create inserts a new booklet row.
func (r *BookletRepo) Create(ctx context.Context, b *model.Booklet) error {
	query := `INSERT INTO booklets (id, course_id, division_id, title, description, current_price, stock, image_url, is_active)
	           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`
	_, err := r.pool.Exec(ctx, query,
		b.ID, b.CourseID, b.DivisionID, b.Title, b.Description,
		b.CurrentPrice, b.Stock, b.ImageURL, b.IsActive,
	)
	if err != nil {
		return fmt.Errorf("insert booklet: %w", err)
	}
	return nil
}

// Update modifies an existing booklet row.
func (r *BookletRepo) Update(ctx context.Context, b *model.Booklet) error {
	query := `UPDATE booklets SET
	           course_id = $2, division_id = $3, title = $4, description = $5,
	           current_price = $6, stock = $7, image_url = $8, is_active = $9,
	           updated_at = NOW()
	           WHERE id = $1`
	tag, err := r.pool.Exec(ctx, query,
		b.ID, b.CourseID, b.DivisionID, b.Title, b.Description,
		b.CurrentPrice, b.Stock, b.ImageURL, b.IsActive,
	)
	if err != nil {
		return fmt.Errorf("update booklet: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return model.ErrNotFound
	}
	return nil
}

// Delete removes a booklet by primary key.
func (r *BookletRepo) Delete(ctx context.Context, id uuid.UUID) error {
	query := `DELETE FROM booklets WHERE id = $1`
	tag, err := r.pool.Exec(ctx, query, id)
	if err != nil {
		return fmt.Errorf("delete booklet: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return model.ErrNotFound
	}
	return nil
}

// UpdateStock updates the stock count for a booklet.
func (r *BookletRepo) UpdateStock(ctx context.Context, id uuid.UUID, stock int) error {
	query := `UPDATE booklets SET stock = $2, updated_at = NOW() WHERE id = $1`
	tag, err := r.pool.Exec(ctx, query, id, stock)
	if err != nil {
		return fmt.Errorf("update booklet stock: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return model.ErrNotFound
	}
	return nil
}

// -- scan helpers --

func scanBooklet(row pgx.Row) (*model.Booklet, error) {
	var b model.Booklet
	err := row.Scan(
		&b.ID, &b.CourseID, &b.DivisionID, &b.Title, &b.Description,
		&b.CurrentPrice, &b.Stock, &b.ImageURL, &b.IsActive,
		&b.CreatedAt, &b.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, model.ErrNotFound
		}
		return nil, fmt.Errorf("scan booklet: %w", err)
	}
	return &b, nil
}

func scanBookletFromRows(rows pgx.Rows) (*model.Booklet, error) {
	var b model.Booklet
	err := rows.Scan(
		&b.ID, &b.CourseID, &b.DivisionID, &b.Title, &b.Description,
		&b.CurrentPrice, &b.Stock, &b.ImageURL, &b.IsActive,
		&b.CreatedAt, &b.UpdatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("scan booklet row: %w", err)
	}
	return &b, nil
}

func collectBooklets(rows pgx.Rows) ([]model.Booklet, error) {
	var booklets []model.Booklet
	for rows.Next() {
		b, err := scanBookletFromRows(rows)
		if err != nil {
			return nil, err
		}
		booklets = append(booklets, *b)
	}
	if booklets == nil {
		booklets = []model.Booklet{}
	}
	return booklets, rows.Err()
}
