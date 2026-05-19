package service

import (
	"context"

	"github.com/google/uuid"
	"github.com/shopspring/decimal"

	"foto-app/internal/domain/model"
	"foto-app/internal/domain/port"
)

// ---------- Request / Response types ----------

// CreateCourseRequest carries the fields needed to create a course.
type CreateCourseRequest struct {
	Name        string  `json:"name"`
	Description *string `json:"description,omitempty"`
}

// UpdateCourseRequest carries the fields to update a course.
type UpdateCourseRequest struct {
	Name        string  `json:"name"`
	Description *string `json:"description,omitempty"`
	IsActive    *bool   `json:"is_active,omitempty"`
}

// CreateDivisionRequest carries the fields needed to create a division.
type CreateDivisionRequest struct {
	CourseID string `json:"course_id"`
	Name     string `json:"name"`
}

// UpdateDivisionRequest carries the fields to update a division.
type UpdateDivisionRequest struct {
	CourseID string `json:"course_id"`
	Name     string `json:"name"`
	IsActive *bool  `json:"is_active,omitempty"`
}

// CreateBookletRequest carries the fields needed to create a booklet.
type CreateBookletRequest struct {
	CourseID    string          `json:"course_id"`
	DivisionID  string          `json:"division_id"`
	Title       string          `json:"title"`
	Description *string         `json:"description,omitempty"`
	Price       decimal.Decimal `json:"price"`
	Stock       int             `json:"stock"`
	ImageURL    *string         `json:"image_url,omitempty"`
	IsActive    *bool           `json:"is_active,omitempty"`
}

// UpdateBookletRequest carries the fields to update a booklet.
type UpdateBookletRequest struct {
	CourseID    string          `json:"course_id"`
	DivisionID  string          `json:"division_id"`
	Title       string          `json:"title"`
	Description *string         `json:"description,omitempty"`
	Price       decimal.Decimal `json:"price"`
	Stock       int             `json:"stock"`
	ImageURL    *string         `json:"image_url,omitempty"`
	IsActive    *bool           `json:"is_active,omitempty"`
}

// ---------- CatalogService ----------

// CatalogService implements business logic for the catalog domain:
// courses, divisions, and booklets.
type CatalogService struct {
	courseRepo   port.CourseRepository
	divisionRepo port.DivisionRepository
	bookletRepo  port.BookletRepository
}

// NewCatalogService creates a CatalogService with its repository dependencies.
func NewCatalogService(
	courseRepo port.CourseRepository,
	divisionRepo port.DivisionRepository,
	bookletRepo port.BookletRepository,
) *CatalogService {
	return &CatalogService{
		courseRepo:   courseRepo,
		divisionRepo: divisionRepo,
		bookletRepo:  bookletRepo,
	}
}

// ==================== Student-facing methods ====================

// ListActiveBookletsByCourse returns active booklets with stock > 0 for the given course.
func (s *CatalogService) ListActiveBookletsByCourse(ctx context.Context, courseID uuid.UUID) ([]model.Booklet, error) {
	return s.bookletRepo.ListActiveByCourse(ctx, courseID)
}

// ListActiveBooklets returns active booklets with stock > 0, with optional filtering and pagination.
func (s *CatalogService) ListActiveBooklets(ctx context.Context, filter port.BookletFilter) ([]model.Booklet, int, error) {
	filter.AdminView = false
	return s.bookletRepo.List(ctx, filter)
}

// GetBooklet retrieves a single booklet by ID (admin view shows all).
func (s *CatalogService) GetBooklet(ctx context.Context, id uuid.UUID) (*model.Booklet, error) {
	return s.bookletRepo.FindByID(ctx, id)
}

// ListCourses returns all courses.
func (s *CatalogService) ListCourses(ctx context.Context) ([]model.Course, error) {
	return s.courseRepo.List(ctx)
}

// ListDivisionsByCourse returns all divisions for a given course.
func (s *CatalogService) ListDivisionsByCourse(ctx context.Context, courseID uuid.UUID) ([]model.Division, error) {
	// Verify course exists first
	if _, err := s.courseRepo.FindByID(ctx, courseID); err != nil {
		return nil, err
	}
	return s.divisionRepo.ListByCourse(ctx, courseID)
}

// GetCourse retrieves a single course.
func (s *CatalogService) GetCourse(ctx context.Context, id uuid.UUID) (*model.Course, error) {
	return s.courseRepo.FindByID(ctx, id)
}

// ==================== Admin methods — Courses ====================

// CreateCourse creates a new course.
func (s *CatalogService) CreateCourse(ctx context.Context, req CreateCourseRequest) (*model.Course, error) {
	course := &model.Course{
		ID:          uuid.New(),
		Name:        req.Name,
		Description: req.Description,
		IsActive:    true,
	}
	if err := s.courseRepo.Create(ctx, course); err != nil {
		return nil, err
	}
	// Re-fetch to get server-set timestamps
	return s.courseRepo.FindByID(ctx, course.ID)
}

// UpdateCourse updates an existing course.
func (s *CatalogService) UpdateCourse(ctx context.Context, id uuid.UUID, req UpdateCourseRequest) (*model.Course, error) {
	course, err := s.courseRepo.FindByID(ctx, id)
	if err != nil {
		return nil, err
	}
	course.Name = req.Name
	if req.Description != nil {
		course.Description = req.Description
	}
	if req.IsActive != nil {
		course.IsActive = *req.IsActive
	}
	if err := s.courseRepo.Update(ctx, course); err != nil {
		return nil, err
	}
	return s.courseRepo.FindByID(ctx, id)
}

// DeleteCourse deletes a course by ID.
func (s *CatalogService) DeleteCourse(ctx context.Context, id uuid.UUID) error {
	return s.courseRepo.Delete(ctx, id)
}

// ==================== Admin methods — Divisions ====================

// CreateDivision creates a new division.
func (s *CatalogService) CreateDivision(ctx context.Context, req CreateDivisionRequest) (*model.Division, error) {
	courseID, err := uuid.Parse(req.CourseID)
	if err != nil {
		return nil, model.ErrValidation
	}
	// Verify course exists
	if _, err := s.courseRepo.FindByID(ctx, courseID); err != nil {
		return nil, err
	}

	division := &model.Division{
		ID:       uuid.New(),
		CourseID: courseID,
		Name:     req.Name,
		IsActive: true,
	}
	if err := s.divisionRepo.Create(ctx, division); err != nil {
		return nil, err
	}
	return s.divisionRepo.FindByID(ctx, division.ID)
}

// UpdateDivision updates an existing division.
func (s *CatalogService) UpdateDivision(ctx context.Context, id uuid.UUID, req UpdateDivisionRequest) (*model.Division, error) {
	courseID, err := uuid.Parse(req.CourseID)
	if err != nil {
		return nil, model.ErrValidation
	}
	division, err := s.divisionRepo.FindByID(ctx, id)
	if err != nil {
		return nil, err
	}
	division.CourseID = courseID
	division.Name = req.Name
	if req.IsActive != nil {
		division.IsActive = *req.IsActive
	}
	if err := s.divisionRepo.Update(ctx, division); err != nil {
		return nil, err
	}
	return s.divisionRepo.FindByID(ctx, id)
}

// DeleteDivision deletes a division by ID.
func (s *CatalogService) DeleteDivision(ctx context.Context, id uuid.UUID) error {
	return s.divisionRepo.Delete(ctx, id)
}

// ==================== Admin methods — Booklets ====================

// CreateBooklet creates a new booklet.
func (s *CatalogService) CreateBooklet(ctx context.Context, req CreateBookletRequest) (*model.Booklet, error) {
	if req.Price.IsNegative() {
		return nil, model.ErrNegativePrice
	}
	if req.Stock < 0 {
		return nil, model.ErrNegativeStock
	}

	courseID, err := uuid.Parse(req.CourseID)
	if err != nil {
		return nil, model.ErrValidation
	}
	divisionID, err := uuid.Parse(req.DivisionID)
	if err != nil {
		return nil, model.ErrValidation
	}

	isActive := true
	if req.IsActive != nil {
		isActive = *req.IsActive
	}

	booklet := &model.Booklet{
		ID:           uuid.New(),
		CourseID:     courseID,
		DivisionID:   divisionID,
		Title:        req.Title,
		Description:  req.Description,
		CurrentPrice: req.Price,
		Stock:        req.Stock,
		ImageURL:     req.ImageURL,
		IsActive:     isActive,
	}
	if err := s.bookletRepo.Create(ctx, booklet); err != nil {
		return nil, err
	}
	return s.bookletRepo.FindByID(ctx, booklet.ID)
}

// UpdateBooklet updates an existing booklet.
func (s *CatalogService) UpdateBooklet(ctx context.Context, id uuid.UUID, req UpdateBookletRequest) (*model.Booklet, error) {
	if req.Price.IsNegative() {
		return nil, model.ErrNegativePrice
	}
	if req.Stock < 0 {
		return nil, model.ErrNegativeStock
	}

	courseID, err := uuid.Parse(req.CourseID)
	if err != nil {
		return nil, model.ErrValidation
	}
	divisionID, err := uuid.Parse(req.DivisionID)
	if err != nil {
		return nil, model.ErrValidation
	}

	booklet, err := s.bookletRepo.FindByID(ctx, id)
	if err != nil {
		return nil, err
	}
	booklet.CourseID = courseID
	booklet.DivisionID = divisionID
	booklet.Title = req.Title
	booklet.Description = req.Description
	booklet.CurrentPrice = req.Price
	booklet.Stock = req.Stock
	booklet.ImageURL = req.ImageURL
	if req.IsActive != nil {
		booklet.IsActive = *req.IsActive
	}

	if err := s.bookletRepo.Update(ctx, booklet); err != nil {
		return nil, err
	}
	return s.bookletRepo.FindByID(ctx, id)
}

// DeleteBooklet deletes a booklet by ID.
func (s *CatalogService) DeleteBooklet(ctx context.Context, id uuid.UUID) error {
	return s.bookletRepo.Delete(ctx, id)
}
