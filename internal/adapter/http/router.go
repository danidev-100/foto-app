package http

import (
	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/cors"
	"github.com/gofiber/fiber/v2/middleware/recover"
	"go.uber.org/zap"

	"foto-app/internal/adapter/http/handler"
	"foto-app/internal/adapter/http/middleware"
)

// SetupRoutes configures all routes, middleware, and handlers on the Fiber app.
// Slice 1 registers only the health endpoint. Subsequent slices add their
// domain routes by calling RegisterRoutes on each handler group.
func SetupRoutes(app *fiber.App, logger *zap.Logger) {
	// --- Global middleware stack (applied to all routes) ---
	app.Use(middleware.Logger(logger))
	app.Use(recover.New())
	app.Use(cors.New(cors.Config{
		AllowOrigins: "*",
		AllowMethods: "GET,POST,PUT,DELETE,PATCH",
		AllowHeaders: "Content-Type,Authorization",
	}))

	// --- Public endpoints (no auth required) ---
	app.Get("/api/health", handler.HealthCheck)

	// --- Route groups for subsequent slices ---
	// Slices 2-6 will register their routes here via:
	//   api := app.Group("/api")
	//   auth := api.Group("/auth")        // Slice 2
	//   catalog := api.Group("/catalog")  // Slice 3
	//   cart := api.Group("/cart")        // Slice 4
	//   orders := api.Group("/orders")    // Slice 5
	//   admin := api.Group("/admin")      // Slices 2-6 admin routes
}
