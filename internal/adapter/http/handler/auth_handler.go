package handler

import (
	"github.com/gofiber/fiber/v2"

	"foto-app/internal/domain/model"
	"foto-app/internal/domain/service"
	"foto-app/pkg/response"
)

// AuthHandler exposes HTTP endpoints for registration and login.
type AuthHandler struct {
	authService *service.AuthService
}

// NewAuthHandler creates an AuthHandler with its service dependency.
func NewAuthHandler(authService *service.AuthService) *AuthHandler {
	return &AuthHandler{authService: authService}
}

// Register handles POST /api/auth/register.
// Creates a new student account. Returns 201 with student data on success.
// Returns 409 AUTH_003 if the email is already registered.
// Returns 400 AUTH_004 if validation fails.
func (h *AuthHandler) Register(c *fiber.Ctx) error {
	var req service.RegisterRequest
	if err := c.BodyParser(&req); err != nil {
		return response.ErrorJSON(c, fiber.StatusBadRequest, "AUTH_004", "invalid request body", nil)
	}

	// Validation
	if req.Name == "" || req.Email == "" || req.Password == "" {
		return response.ErrorJSON(c, fiber.StatusBadRequest, "AUTH_004", "name, email, and password are required", nil)
	}

	student, err := h.authService.Register(c.Context(), req)
	if err != nil {
		if err == model.ErrConflict {
			return response.ErrorJSON(c, fiber.StatusConflict, "AUTH_003", "email already registered", nil)
		}
		return response.ErrorJSON(c, fiber.StatusInternalServerError, "INF_001", "internal server error", nil)
	}

	return response.SuccessJSON(c, fiber.StatusCreated, student)
}

// Login handles POST /api/auth/login.
// Authenticates a student and returns a JWT token.
// Returns 401 AUTH_005 if credentials are invalid.
// Returns 400 AUTH_004 if validation fails.
func (h *AuthHandler) Login(c *fiber.Ctx) error {
	var req service.LoginRequest
	if err := c.BodyParser(&req); err != nil {
		return response.ErrorJSON(c, fiber.StatusBadRequest, "AUTH_004", "invalid request body", nil)
	}

	if req.Email == "" || req.Password == "" {
		return response.ErrorJSON(c, fiber.StatusBadRequest, "AUTH_004", "email and password are required", nil)
	}

	resp, err := h.authService.Login(c.Context(), req)
	if err != nil {
		if err == model.ErrInvalidCredentials {
			return response.ErrorJSON(c, fiber.StatusUnauthorized, "AUTH_005", "invalid email or password", nil)
		}
		return response.ErrorJSON(c, fiber.StatusInternalServerError, "INF_001", "internal server error", nil)
	}

	return response.SuccessJSON(c, fiber.StatusOK, resp)
}
