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
// Parameters grow as each slice adds its handlers.
func SetupRoutes(
	app *fiber.App,
	logger *zap.Logger,
	authHandler *handler.AuthHandler,
	catalogHandler *handler.CatalogHandler,
	jwtSecret string,
) {
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

	// --- Slice 3: Catalog routes ---

	// Student-facing catalog (public)
	catalog := api.Group("/catalog")
	catalog.Get("/courses", catalogHandler.ListCourses)
	catalog.Get("/courses/:id/divisions", catalogHandler.ListDivisionsByCourse)

	// Student-facing catalog (auth required)
	catalogAuth := catalog.Group("")
	catalogAuth.Use(middleware.AuthMiddleware(jwtSecret))
	catalogAuth.Get("/booklets", catalogHandler.ListBooklets)
	catalogAuth.Get("/booklets/:id", catalogHandler.GetBooklet)

	// Admin catalog routes (auth + admin required)
	admin := api.Group("/admin")
	admin.Use(middleware.AuthMiddleware(jwtSecret))
	admin.Use(middleware.AdminMiddleware)
	admin.Post("/courses", catalogHandler.CreateCourse)
	admin.Put("/courses/:id", catalogHandler.UpdateCourse)
	admin.Delete("/courses/:id", catalogHandler.DeleteCourse)
	admin.Post("/divisions", catalogHandler.CreateDivision)
	admin.Put("/divisions/:id", catalogHandler.UpdateDivision)
	admin.Delete("/divisions/:id", catalogHandler.DeleteDivision)
	admin.Post("/booklets", catalogHandler.CreateBooklet)
	admin.Put("/booklets/:id", catalogHandler.UpdateBooklet)
	admin.Delete("/booklets/:id", catalogHandler.DeleteBooklet)
}
