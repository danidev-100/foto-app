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

// DivisionRepo implements port.DivisionRepository using pgx.
type DivisionRepo struct {
	pool *pgxpool.Pool
}

// NewDivisionRepo creates a new pgx-backed DivisionRepo.
func NewDivisionRepo(pool *pgxpool.Pool) *DivisionRepo {
	return &DivisionRepo{pool: pool}
}

// FindByID retrieves a division by primary key. Returns model.ErrNotFound if missing.
func (r *DivisionRepo) FindByID(ctx context.Context, id uuid.UUID) (*model.Division, error) {
	query := `SELECT id, course_id, name, is_active, created_at, updated_at
	           FROM divisions WHERE id = $1`
	row := r.pool.QueryRow(ctx, query, id)
	return scanDivision(row)
}

// ListByCourse returns all divisions for a given course ordered by name.
func (r *DivisionRepo) ListByCourse(ctx context.Context, courseID uuid.UUID) ([]model.Division, error) {
	query := `SELECT id, course_id, name, is_active, created_at, updated_at
	           FROM divisions WHERE course_id = $1 ORDER BY name`
	rows, err := r.pool.Query(ctx, query, courseID)
	if err != nil {
		return nil, fmt.Errorf("list divisions by course: %w", err)
	}
	defer rows.Close()

	var divisions []model.Division
	for rows.Next() {
		var d model.Division
		if err := rows.Scan(&d.ID, &d.CourseID, &d.Name, &d.IsActive, &d.CreatedAt, &d.UpdatedAt); err != nil {
			return nil, fmt.Errorf("scan division: %w", err)
		}
		divisions = append(divisions, d)
	}
	if divisions == nil {
		divisions = []model.Division{}
	}
	return divisions, rows.Err()
}

// ListAll returns all divisions ordered by course_id and name.
func (r *DivisionRepo) ListAll(ctx context.Context) ([]model.Division, error) {
	query := `SELECT id, course_id, name, is_active, created_at, updated_at
	           FROM divisions ORDER BY course_id, name`
	rows, err := r.pool.Query(ctx, query)
	if err != nil {
		return nil, fmt.Errorf("list all divisions: %w", err)
	}
	defer rows.Close()

	var divisions []model.Division
	for rows.Next() {
		var d model.Division
		if err := rows.Scan(&d.ID, &d.CourseID, &d.Name, &d.IsActive, &d.CreatedAt, &d.UpdatedAt); err != nil {
			return nil, fmt.Errorf("scan division: %w", err)
		}
		divisions = append(divisions, d)
	}
	if divisions == nil {
		divisions = []model.Division{}
	}
	return divisions, rows.Err()
}

// Create inserts a new division row.
func (r *DivisionRepo) Create(ctx context.Context, d *model.Division) error {
	query := `INSERT INTO divisions (id, course_id, name, is_active)
	           VALUES ($1, $2, $3, $4)`
	_, err := r.pool.Exec(ctx, query, d.ID, d.CourseID, d.Name, d.IsActive)
	if err != nil {
		return fmt.Errorf("insert division: %w", err)
	}
	return nil
}

// Update modifies an existing division row.
func (r *DivisionRepo) Update(ctx context.Context, d *model.Division) error {
	query := `UPDATE divisions SET name = $2, is_active = $3, updated_at = NOW()
	           WHERE id = $1 AND course_id = $4`
	tag, err := r.pool.Exec(ctx, query, d.ID, d.Name, d.IsActive, d.CourseID)
	if err != nil {
		return fmt.Errorf("update division: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return model.ErrNotFound
	}
	return nil
}

// Delete removes a division by primary key.
func (r *DivisionRepo) Delete(ctx context.Context, id uuid.UUID) error {
	query := `DELETE FROM divisions WHERE id = $1`
	tag, err := r.pool.Exec(ctx, query, id)
	if err != nil {
		return fmt.Errorf("delete division: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return model.ErrNotFound
	}
	return nil
}

// scanDivision scans a pgx.Row into a Division model.
func scanDivision(row pgx.Row) (*model.Division, error) {
	var d model.Division
	err := row.Scan(&d.ID, &d.CourseID, &d.Name, &d.IsActive, &d.CreatedAt, &d.UpdatedAt)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, model.ErrNotFound
		}
		return nil, fmt.Errorf("scan division: %w", err)
	}
	return &d, nil
}
