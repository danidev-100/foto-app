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

// CourseRepo implements port.CourseRepository using pgx.
type CourseRepo struct {
	pool *pgxpool.Pool
}

// NewCourseRepo creates a new pgx-backed CourseRepo.
func NewCourseRepo(pool *pgxpool.Pool) *CourseRepo {
	return &CourseRepo{pool: pool}
}

// FindByID retrieves a course by primary key. Returns model.ErrNotFound if missing.
func (r *CourseRepo) FindByID(ctx context.Context, id uuid.UUID) (*model.Course, error) {
	query := `SELECT id, name, description, is_active, created_at, updated_at
	           FROM courses WHERE id = $1`
	row := r.pool.QueryRow(ctx, query, id)
	return scanCourse(row)
}

// List returns all courses ordered by name.
func (r *CourseRepo) List(ctx context.Context) ([]model.Course, error) {
	query := `SELECT id, name, description, is_active, created_at, updated_at
	           FROM courses ORDER BY name`
	rows, err := r.pool.Query(ctx, query)
	if err != nil {
		return nil, fmt.Errorf("list courses: %w", err)
	}
	defer rows.Close()

	var courses []model.Course
	for rows.Next() {
		var c model.Course
		if err := rows.Scan(&c.ID, &c.Name, &c.Description, &c.IsActive, &c.CreatedAt, &c.UpdatedAt); err != nil {
			return nil, fmt.Errorf("scan course: %w", err)
		}
		courses = append(courses, c)
	}
	if courses == nil {
		courses = []model.Course{}
	}
	return courses, rows.Err()
}

// Create inserts a new course row.
func (r *CourseRepo) Create(ctx context.Context, c *model.Course) error {
	query := `INSERT INTO courses (id, name, description, is_active)
	           VALUES ($1, $2, $3, $4)`
	_, err := r.pool.Exec(ctx, query, c.ID, c.Name, c.Description, c.IsActive)
	if err != nil {
		return fmt.Errorf("insert course: %w", err)
	}
	return nil
}

// Update modifies an existing course row.
func (r *CourseRepo) Update(ctx context.Context, c *model.Course) error {
	query := `UPDATE courses SET name = $2, description = $3, is_active = $4, updated_at = NOW()
	           WHERE id = $1`
	tag, err := r.pool.Exec(ctx, query, c.ID, c.Name, c.Description, c.IsActive)
	if err != nil {
		return fmt.Errorf("update course: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return model.ErrNotFound
	}
	return nil
}

// Delete removes a course by primary key.
func (r *CourseRepo) Delete(ctx context.Context, id uuid.UUID) error {
	query := `DELETE FROM courses WHERE id = $1`
	tag, err := r.pool.Exec(ctx, query, id)
	if err != nil {
		return fmt.Errorf("delete course: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return model.ErrNotFound
	}
	return nil
}

// scanCourse scans a pgx.Row into a Course model.
func scanCourse(row pgx.Row) (*model.Course, error) {
	var c model.Course
	err := row.Scan(&c.ID, &c.Name, &c.Description, &c.IsActive, &c.CreatedAt, &c.UpdatedAt)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, model.ErrNotFound
		}
		return nil, fmt.Errorf("scan course: %w", err)
	}
	return &c, nil
}
