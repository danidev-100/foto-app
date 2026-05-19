package handler

import (
	"strconv"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"

	"foto-app/internal/domain/model"
	"foto-app/internal/domain/port"
	"foto-app/internal/domain/service"
	"foto-app/pkg/response"
)

// CatalogHandler exposes HTTP endpoints for the catalog domain.
// Contains both student-facing and admin methods.
type CatalogHandler struct {
	catalogService *service.CatalogService
}

// NewCatalogHandler creates a CatalogHandler with its service dependency.
func NewCatalogHandler(catalogService *service.CatalogService) *CatalogHandler {
	return &CatalogHandler{catalogService: catalogService}
}

// ---------- Shared helpers ----------

func parsePagination(c *fiber.Ctx) (page, limit int) {
	page, _ = strconv.Atoi(c.Query("page", "1"))
	limit, _ = strconv.Atoi(c.Query("per_page", "20"))
	if page < 1 {
		page = 1
	}
	if limit < 1 || limit > 100 {
		limit = 20
	}
	return
}

// ==================== Student-facing: Courses ====================

// ListCourses handles GET /api/catalog/courses.
func (h *CatalogHandler) ListCourses(c *fiber.Ctx) error {
	courses, err := h.catalogService.ListCourses(c.Context())
	if err != nil {
		return response.ErrorJSON(c, fiber.StatusInternalServerError, "INF_001", "failed to list courses", nil)
	}
	return response.SuccessJSON(c, fiber.StatusOK, courses)
}

// ListDivisionsByCourse handles GET /api/catalog/courses/:id/divisions.
func (h *CatalogHandler) ListDivisionsByCourse(c *fiber.Ctx) error {
	courseID, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return response.ErrorJSON(c, fiber.StatusBadRequest, "AUTH_004", "invalid course ID", nil)
	}

	divisions, err := h.catalogService.ListDivisionsByCourse(c.Context(), courseID)
	if err != nil {
		if err == model.ErrNotFound {
			return response.ErrorJSON(c, fiber.StatusNotFound, "CAT_001", "course not found", nil)
		}
		return response.ErrorJSON(c, fiber.StatusInternalServerError, "INF_001", "failed to list divisions", nil)
	}
	return response.SuccessJSON(c, fiber.StatusOK, divisions)
}

// ==================== Student-facing: Booklets (auth required) ====================

// ListBooklets handles GET /api/catalog/booklets?course_id=X&page=1&per_page=20.
func (h *CatalogHandler) ListBooklets(c *fiber.Ctx) error {
	var filter port.BookletFilter

	if courseIDStr := c.Query("course_id"); courseIDStr != "" {
		courseID, err := uuid.Parse(courseIDStr)
		if err != nil {
			return response.ErrorJSON(c, fiber.StatusBadRequest, "AUTH_004", "invalid course_id", nil)
		}
		filter.CourseID = &courseID
	}
	if divisionIDStr := c.Query("division_id"); divisionIDStr != "" {
		divisionID, err := uuid.Parse(divisionIDStr)
		if err != nil {
			return response.ErrorJSON(c, fiber.StatusBadRequest, "AUTH_004", "invalid division_id", nil)
		}
		filter.DivisionID = &divisionID
	}

	page, limit := parsePagination(c)
	filter.Page = page
	filter.Limit = limit

	booklets, total, err := h.catalogService.ListActiveBooklets(c.Context(), filter)
	if err != nil {
		return response.ErrorJSON(c, fiber.StatusInternalServerError, "INF_001", "failed to list booklets", nil)
	}

	return response.PaginatedJSON(c, booklets, page, limit, total)
}

// GetBooklet handles GET /api/catalog/booklets/:id.
func (h *CatalogHandler) GetBooklet(c *fiber.Ctx) error {
	id, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return response.ErrorJSON(c, fiber.StatusBadRequest, "AUTH_004", "invalid booklet ID", nil)
	}

	booklet, err := h.catalogService.GetBooklet(c.Context(), id)
	if err != nil {
		if err == model.ErrNotFound {
			return response.ErrorJSON(c, fiber.StatusNotFound, "CAT_003", "booklet not found", nil)
		}
		return response.ErrorJSON(c, fiber.StatusInternalServerError, "INF_001", "failed to get booklet", nil)
	}
	return response.SuccessJSON(c, fiber.StatusOK, booklet)
}

// ==================== Admin: Courses ====================

// CreateCourse handles POST /api/admin/courses.
func (h *CatalogHandler) CreateCourse(c *fiber.Ctx) error {
	var req service.CreateCourseRequest
	if err := c.BodyParser(&req); err != nil {
		return response.ErrorJSON(c, fiber.StatusBadRequest, "AUTH_004", "invalid request body", nil)
	}
	if req.Name == "" {
		return response.ErrorJSON(c, fiber.StatusBadRequest, "AUTH_004", "name is required", nil)
	}

	course, err := h.catalogService.CreateCourse(c.Context(), req)
	if err != nil {
		return response.ErrorJSON(c, fiber.StatusInternalServerError, "INF_001", "failed to create course", nil)
	}
	return response.SuccessJSON(c, fiber.StatusCreated, course)
}

// UpdateCourse handles PUT /api/admin/courses/:id.
func (h *CatalogHandler) UpdateCourse(c *fiber.Ctx) error {
	id, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return response.ErrorJSON(c, fiber.StatusBadRequest, "AUTH_004", "invalid course ID", nil)
	}

	var req service.UpdateCourseRequest
	if err := c.BodyParser(&req); err != nil {
		return response.ErrorJSON(c, fiber.StatusBadRequest, "AUTH_004", "invalid request body", nil)
	}
	if req.Name == "" {
		return response.ErrorJSON(c, fiber.StatusBadRequest, "AUTH_004", "name is required", nil)
	}

	course, err := h.catalogService.UpdateCourse(c.Context(), id, req)
	if err != nil {
		if err == model.ErrNotFound {
			return response.ErrorJSON(c, fiber.StatusNotFound, "CAT_001", "course not found", nil)
		}
		return response.ErrorJSON(c, fiber.StatusInternalServerError, "INF_001", "failed to update course", nil)
	}
	return response.SuccessJSON(c, fiber.StatusOK, course)
}

// DeleteCourse handles DELETE /api/admin/courses/:id.
func (h *CatalogHandler) DeleteCourse(c *fiber.Ctx) error {
	id, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return response.ErrorJSON(c, fiber.StatusBadRequest, "AUTH_004", "invalid course ID", nil)
	}

	if err := h.catalogService.DeleteCourse(c.Context(), id); err != nil {
		if err == model.ErrNotFound {
			return response.ErrorJSON(c, fiber.StatusNotFound, "CAT_001", "course not found", nil)
		}
		return response.ErrorJSON(c, fiber.StatusInternalServerError, "INF_001", "failed to delete course", nil)
	}
	return response.SuccessJSON(c, fiber.StatusOK, map[string]string{"message": "course deleted"})
}

// ==================== Admin: Divisions ====================

// CreateDivision handles POST /api/admin/divisions.
func (h *CatalogHandler) CreateDivision(c *fiber.Ctx) error {
	var req service.CreateDivisionRequest
	if err := c.BodyParser(&req); err != nil {
		return response.ErrorJSON(c, fiber.StatusBadRequest, "AUTH_004", "invalid request body", nil)
	}
	if req.Name == "" || req.CourseID == "" {
		return response.ErrorJSON(c, fiber.StatusBadRequest, "AUTH_004", "name and course_id are required", nil)
	}

	division, err := h.catalogService.CreateDivision(c.Context(), req)
	if err != nil {
		if err == model.ErrNotFound {
			return response.ErrorJSON(c, fiber.StatusNotFound, "CAT_001", "course not found", nil)
		}
		if err == model.ErrValidation {
			return response.ErrorJSON(c, fiber.StatusBadRequest, "AUTH_004", "invalid course_id format", nil)
		}
		return response.ErrorJSON(c, fiber.StatusInternalServerError, "INF_001", "failed to create division", nil)
	}
	return response.SuccessJSON(c, fiber.StatusCreated, division)
}

// UpdateDivision handles PUT /api/admin/divisions/:id.
func (h *CatalogHandler) UpdateDivision(c *fiber.Ctx) error {
	id, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return response.ErrorJSON(c, fiber.StatusBadRequest, "AUTH_004", "invalid division ID", nil)
	}

	var req service.UpdateDivisionRequest
	if err := c.BodyParser(&req); err != nil {
		return response.ErrorJSON(c, fiber.StatusBadRequest, "AUTH_004", "invalid request body", nil)
	}
	if req.Name == "" || req.CourseID == "" {
		return response.ErrorJSON(c, fiber.StatusBadRequest, "AUTH_004", "name and course_id are required", nil)
	}

	division, err := h.catalogService.UpdateDivision(c.Context(), id, req)
	if err != nil {
		if err == model.ErrNotFound {
			return response.ErrorJSON(c, fiber.StatusNotFound, "CAT_002", "division not found", nil)
		}
		if err == model.ErrValidation {
			return response.ErrorJSON(c, fiber.StatusBadRequest, "AUTH_004", "invalid course_id format", nil)
		}
		return response.ErrorJSON(c, fiber.StatusInternalServerError, "INF_001", "failed to update division", nil)
	}
	return response.SuccessJSON(c, fiber.StatusOK, division)
}

// DeleteDivision handles DELETE /api/admin/divisions/:id.
func (h *CatalogHandler) DeleteDivision(c *fiber.Ctx) error {
	id, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return response.ErrorJSON(c, fiber.StatusBadRequest, "AUTH_004", "invalid division ID", nil)
	}

	if err := h.catalogService.DeleteDivision(c.Context(), id); err != nil {
		if err == model.ErrNotFound {
			return response.ErrorJSON(c, fiber.StatusNotFound, "CAT_002", "division not found", nil)
		}
		return response.ErrorJSON(c, fiber.StatusInternalServerError, "INF_001", "failed to delete division", nil)
	}
	return response.SuccessJSON(c, fiber.StatusOK, map[string]string{"message": "division deleted"})
}

// ==================== Admin: Booklets ====================

// CreateBooklet handles POST /api/admin/booklets.
func (h *CatalogHandler) CreateBooklet(c *fiber.Ctx) error {
	var req service.CreateBookletRequest
	if err := c.BodyParser(&req); err != nil {
		return response.ErrorJSON(c, fiber.StatusBadRequest, "AUTH_004", "invalid request body", nil)
	}
	if req.Title == "" || req.CourseID == "" || req.DivisionID == "" {
		return response.ErrorJSON(c, fiber.StatusBadRequest, "AUTH_004", "title, course_id, and division_id are required", nil)
	}

	booklet, err := h.catalogService.CreateBooklet(c.Context(), req)
	if err != nil {
		if err == model.ErrNegativePrice {
			return response.ErrorJSON(c, fiber.StatusBadRequest, "CAT_005", "price must be non-negative", nil)
		}
		if err == model.ErrNegativeStock {
			return response.ErrorJSON(c, fiber.StatusBadRequest, "CAT_006", "stock must be non-negative", nil)
		}
		if err == model.ErrValidation {
			return response.ErrorJSON(c, fiber.StatusBadRequest, "AUTH_004", "invalid UUID format for course_id or division_id", nil)
		}
		return response.ErrorJSON(c, fiber.StatusInternalServerError, "INF_001", "failed to create booklet", nil)
	}
	return response.SuccessJSON(c, fiber.StatusCreated, booklet)
}

// UpdateBooklet handles PUT /api/admin/booklets/:id.
func (h *CatalogHandler) UpdateBooklet(c *fiber.Ctx) error {
	id, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return response.ErrorJSON(c, fiber.StatusBadRequest, "AUTH_004", "invalid booklet ID", nil)
	}

	var req service.UpdateBookletRequest
	if err := c.BodyParser(&req); err != nil {
		return response.ErrorJSON(c, fiber.StatusBadRequest, "AUTH_004", "invalid request body", nil)
	}
	if req.Title == "" || req.CourseID == "" || req.DivisionID == "" {
		return response.ErrorJSON(c, fiber.StatusBadRequest, "AUTH_004", "title, course_id, and division_id are required", nil)
	}

	booklet, err := h.catalogService.UpdateBooklet(c.Context(), id, req)
	if err != nil {
		if err == model.ErrNotFound {
			return response.ErrorJSON(c, fiber.StatusNotFound, "CAT_003", "booklet not found", nil)
		}
		if err == model.ErrNegativePrice {
			return response.ErrorJSON(c, fiber.StatusBadRequest, "CAT_005", "price must be non-negative", nil)
		}
		if err == model.ErrNegativeStock {
			return response.ErrorJSON(c, fiber.StatusBadRequest, "CAT_006", "stock must be non-negative", nil)
		}
		if err == model.ErrValidation {
			return response.ErrorJSON(c, fiber.StatusBadRequest, "AUTH_004", "invalid UUID format for course_id or division_id", nil)
		}
		return response.ErrorJSON(c, fiber.StatusInternalServerError, "INF_001", "failed to update booklet", nil)
	}
	return response.SuccessJSON(c, fiber.StatusOK, booklet)
}

// DeleteBooklet handles DELETE /api/admin/booklets/:id.
func (h *CatalogHandler) DeleteBooklet(c *fiber.Ctx) error {
	id, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return response.ErrorJSON(c, fiber.StatusBadRequest, "AUTH_004", "invalid booklet ID", nil)
	}

	if err := h.catalogService.DeleteBooklet(c.Context(), id); err != nil {
		if err == model.ErrNotFound {
			return response.ErrorJSON(c, fiber.StatusNotFound, "CAT_003", "booklet not found", nil)
		}
		return response.ErrorJSON(c, fiber.StatusInternalServerError, "INF_001", "failed to delete booklet", nil)
	}
	return response.SuccessJSON(c, fiber.StatusOK, map[string]string{"message": "booklet deleted"})
}
