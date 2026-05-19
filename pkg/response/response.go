package response

import (
	"time"

	"github.com/gofiber/fiber/v2"
)

// Standard response envelopes for the API.
// All responses follow the same JSON structure for consistency.

// APIResponse is the generic envelope for all API responses.
type APIResponse struct {
	Success bool        `json:"success"`
	Data    interface{} `json:"data,omitempty"`
	Error   *APIError   `json:"error,omitempty"`
}

// APIError represents a structured error in API responses.
type APIError struct {
	Code    string      `json:"code"`
	Message string      `json:"message"`
	Details interface{} `json:"details,omitempty"`
}

// Pagination represents pagination metadata for list endpoints.
type Pagination struct {
	Page       int `json:"page"`
	Limit      int `json:"limit"`
	Total      int `json:"total"`
	TotalPages int `json:"total_pages"`
}

// PaginatedResponse wraps data with pagination metadata.
type PaginatedResponse struct {
	Data       interface{} `json:"data"`
	Pagination Pagination  `json:"pagination"`
}

// SuccessJSON sends a successful response with the given status code and data.
func SuccessJSON(c *fiber.Ctx, status int, data interface{}) error {
	return c.Status(status).JSON(APIResponse{
		Success: true,
		Data:    data,
	})
}

// ErrorJSON sends an error response with the given status code, error code, and message.
func ErrorJSON(c *fiber.Ctx, status int, code, message string, details interface{}) error {
	return c.Status(status).JSON(APIResponse{
		Success: false,
		Error: &APIError{
			Code:    code,
			Message: message,
			Details: details,
		},
	})
}

// PaginatedJSON sends a paginated response with data and pagination metadata.
func PaginatedJSON(c *fiber.Ctx, data interface{}, page, limit, total int) error {
	totalPages := 0
	if limit > 0 {
		totalPages = (total + limit - 1) / limit
	}

	return c.JSON(PaginatedResponse{
		Data: data,
		Pagination: Pagination{
			Page:       page,
			Limit:      limit,
			Total:      total,
			TotalPages: totalPages,
		},
	})
}

// HealthResponse represents the health check endpoint response.
type HealthResponse struct {
	Status    string `json:"status"`
	Timestamp string `json:"timestamp"`
}

// NewHealthResponse creates a new health response with the current time.
func NewHealthResponse() HealthResponse {
	return HealthResponse{
		Status:    "ok",
		Timestamp: time.Now().UTC().Format(time.RFC3339),
	}
}
