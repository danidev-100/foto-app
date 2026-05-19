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
	cartHandler *handler.CartHandler,
	orderHandler *handler.OrderHandler,
	paymentHandler *handler.PaymentHandler,
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

	// --- Slice 4: Cart routes (all require auth) ---
	cart := api.Group("/cart")
	cart.Use(middleware.AuthMiddleware(jwtSecret))
	cart.Get("/", cartHandler.GetCart)
	cart.Post("/items", cartHandler.AddItem)
	cart.Put("/items/:booklet_id", cartHandler.UpdateItem)
	cart.Delete("/items/:booklet_id", cartHandler.RemoveItem)
	cart.Delete("/", cartHandler.ClearCart)

	// --- Slice 5: Order routes (student-facing, all require auth) ---
	orders := api.Group("/orders")
	orders.Use(middleware.AuthMiddleware(jwtSecret))
	orders.Post("/", orderHandler.PlaceOrder)
	orders.Get("/", orderHandler.ListOrders)
	orders.Get("/:id", orderHandler.GetOrder)
	orders.Post("/:id/cancel", orderHandler.CancelOrder)

	// --- Slice 5: Admin order routes (auth + admin) ---
	adminOrders := admin.Group("/orders")
	adminOrders.Get("/", orderHandler.ListAllOrders)
	adminOrders.Get("/:id", orderHandler.GetOrderAdmin)
	adminOrders.Put("/:id/status", orderHandler.UpdateOrderStatus)

	// --- Slice 6: Payment routes ---

	// Student-facing: initiate payment for an order
	orders.Post("/:id/pay", paymentHandler.InitiatePayment)

	// Webhook: MP IPN (no auth — validated by idempotency)
	webhook := app.Group("/api/webhooks")
	webhook.Post("/mercadopago", paymentHandler.HandleMPWebhook)

	// Admin: confirm cash payment
	admin.Post("/orders/:id/pay-cash", paymentHandler.ConfirmCashPayment)
}
