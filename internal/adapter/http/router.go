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
// Each slice registers its domain routes via handler parameters.
func SetupRoutes(app *fiber.App, logger *zap.Logger, authHandler *handler.AuthHandler) {
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

	// --- Slice 2: Auth routes ---
	api := app.Group("/api")
	auth := api.Group("/auth")
	auth.Post("/register", authHandler.Register)
	auth.Post("/login", authHandler.Login)
}
