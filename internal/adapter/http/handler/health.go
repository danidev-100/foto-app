package handler

import (
	"github.com/gofiber/fiber/v2"
	"foto-app/pkg/response"
)

// HealthCheck handles GET /api/health.
// Returns a simple status response indicating the service is running.
func HealthCheck(c *fiber.Ctx) error {
	return response.SuccessJSON(c, fiber.StatusOK, response.NewHealthResponse())
}
