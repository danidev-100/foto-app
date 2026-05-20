package repository

import (
	"context"
	"errors"
	"fmt"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"

	"foto-app/internal/domain/model"
)

// StudentRepo implements port.StudentRepository using pgx.
type StudentRepo struct {
	pool *pgxpool.Pool
}

// NewStudentRepo creates a new pgx-backed StudentRepo.
func NewStudentRepo(pool *pgxpool.Pool) *StudentRepo {
	return &StudentRepo{pool: pool}
}

// Create inserts a new student row. Returns model.ErrConflict on email duplicate (SQLSTATE 23505).
func (r *StudentRepo) Create(ctx context.Context, s *model.Student) error {
	query := `INSERT INTO students (id, name, email, password_hash, phone, course_id, is_admin)
	           VALUES ($1, $2, $3, $4, $5, $6, $7)`
	_, err := r.pool.Exec(ctx, query,
		s.ID, s.Name, s.Email, s.PasswordHash, s.Phone, s.CourseID, s.IsAdmin,
	)
	if err != nil {
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) && pgErr.Code == "23505" {
			return model.ErrConflict
		}
		return fmt.Errorf("insert student: %w", err)
	}
	return nil
}

// FindByEmail retrieves a student by email. Returns model.ErrNotFound if missing.
func (r *StudentRepo) FindByEmail(ctx context.Context, email string) (*model.Student, error) {
	query := `SELECT id, name, email, password_hash, phone, course_id, is_admin, is_active, created_at, updated_at
	           FROM students WHERE email = $1`
	row := r.pool.QueryRow(ctx, query, email)
	return scanStudent(row)
}

// FindByID retrieves a student by primary key. Returns model.ErrNotFound if missing.
func (r *StudentRepo) FindByID(ctx context.Context, id uuid.UUID) (*model.Student, error) {
	query := `SELECT id, name, email, password_hash, phone, course_id, is_admin, is_active, created_at, updated_at
	           FROM students WHERE id = $1`
	row := r.pool.QueryRow(ctx, query, id)
	return scanStudent(row)
}

// FindAll returns a paginated list of all students and the total count.
func (r *StudentRepo) FindAll(ctx context.Context, page, limit int) ([]*model.Student, int, error) {
	var total int
	err := r.pool.QueryRow(ctx, "SELECT count(*) FROM students").Scan(&total)
	if err != nil {
		return nil, 0, fmt.Errorf("count students: %w", err)
	}

	offset := (page - 1) * limit
	query := `SELECT id, name, email, password_hash, phone, course_id, is_admin, is_active, created_at, updated_at
		FROM students ORDER BY created_at DESC LIMIT $1 OFFSET $2`
	rows, err := r.pool.Query(ctx, query, limit, offset)
	if err != nil {
		return nil, 0, fmt.Errorf("list students: %w", err)
	}
	defer rows.Close()

	var students []*model.Student
	for rows.Next() {
		s, err := scanStudentRow(rows)
		if err != nil {
			return nil, 0, err
		}
		students = append(students, s)
	}
	if err := rows.Err(); err != nil {
		return nil, 0, fmt.Errorf("iterate students: %w", err)
	}
	return students, total, nil
}

// Update persists changes to an existing student.
func (r *StudentRepo) Update(ctx context.Context, s *model.Student) error {
	query := `UPDATE students SET name=$2, email=$3, phone=$4, course_id=$5, is_admin=$6, is_active=$7, updated_at=NOW()
		WHERE id=$1`
	_, err := r.pool.Exec(ctx, query, s.ID, s.Name, s.Email, s.Phone, s.CourseID, s.IsAdmin, s.IsActive)
	if err != nil {
		return fmt.Errorf("update student: %w", err)
	}
	return nil
}

// scanStudentRow scans a pgx.Row or pgx.Rows into a Student model.
func scanStudentRow(row interface{ Scan(dest ...interface{}) error }) (*model.Student, error) {
	var s model.Student
	err := row.Scan(
		&s.ID, &s.Name, &s.Email, &s.PasswordHash,
		&s.Phone, &s.CourseID, &s.IsAdmin, &s.IsActive,
		&s.CreatedAt, &s.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, model.ErrNotFound
		}
		return nil, fmt.Errorf("scan student: %w", err)
	}
	return &s, nil
}

// scanStudent scans a pgx.Row into a Student model.
func scanStudent(row pgx.Row) (*model.Student, error) {
	return scanStudentRow(row)
}
