package handler

import (
	"log"
	"strconv"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"

	"foto-app/internal/domain/model"
	"foto-app/internal/domain/port"
	"foto-app/pkg/response"
)

// UserHandler handles admin user management endpoints.
type UserHandler struct {
	studentRepo port.StudentRepository
}

// NewUserHandler creates a new UserHandler.
func NewUserHandler(studentRepo port.StudentRepository) *UserHandler {
	return &UserHandler{studentRepo: studentRepo}
}

// ListStudents handles GET /api/admin/students?page=1&per_page=20
func (h *UserHandler) ListStudents(c *fiber.Ctx) error {
	page, _ := strconv.Atoi(c.Query("page", "1"))
	limit, _ := strconv.Atoi(c.Query("per_page", "20"))
	if page < 1 {
		page = 1
	}
	if limit < 1 || limit > 100 {
		limit = 20
	}

	students, total, err := h.studentRepo.FindAll(c.Context(), page, limit)
	if err != nil {
		log.Printf("ListStudents error: %v", err)
		return response.ErrorJSON(c, 500, "INF_001", "failed to list students", nil)
	}
	return response.PaginatedJSON(c, students, page, limit, total)
}

// UpdateStudent handles PATCH /api/admin/students/:id
// Body: { "is_admin": true/false, "is_active": true/false }
func (h *UserHandler) UpdateStudent(c *fiber.Ctx) error {
	id, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return response.ErrorJSON(c, 400, "AUTH_004", "invalid student ID", nil)
	}

	student, err := h.studentRepo.FindByID(c.Context(), id)
	if err != nil {
		if err == model.ErrNotFound {
			return response.ErrorJSON(c, 404, "USR_001", "student not found", nil)
		}
		log.Printf("UpdateStudent find error: %v", err)
		return response.ErrorJSON(c, 500, "INF_001", "failed to find student", nil)
	}

	var req struct {
		IsAdmin  *bool `json:"is_admin,omitempty"`
		IsActive *bool `json:"is_active,omitempty"`
	}
	if err := c.BodyParser(&req); err != nil {
		return response.ErrorJSON(c, 400, "AUTH_004", "invalid request body", nil)
	}

	if req.IsAdmin != nil {
		student.IsAdmin = *req.IsAdmin
	}
	if req.IsActive != nil {
		student.IsActive = *req.IsActive
	}

	if err := h.studentRepo.Update(c.Context(), student); err != nil {
		log.Printf("UpdateStudent error: %v", err)
		return response.ErrorJSON(c, 500, "INF_001", "failed to update student", nil)
	}

	return response.SuccessJSON(c, 200, student)
}
