package handler

import (
	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"

	"foto-app/internal/domain/model"
	"foto-app/internal/domain/service"
	"foto-app/pkg/response"
)

// OrderHandler exposes HTTP endpoints for the order domain.
// Student-facing endpoints require AuthMiddleware.
// Admin endpoints require AuthMiddleware + AdminMiddleware.
type OrderHandler struct {
	orderService *service.OrderService
}

// NewOrderHandler creates an OrderHandler with its service dependency.
func NewOrderHandler(orderService *service.OrderService) *OrderHandler {
	return &OrderHandler{orderService: orderService}
}

// ---------- Student-facing endpoints ----------

// PlaceOrder handles POST /api/orders.
// Creates an order from the authenticated student's cart.
// Returns 201 with the order on success.
// Returns 400 CART_002 if the cart is empty.
// Returns 400 CART_001 if stock is insufficient.
// Returns 400 PAY_002 if the payment method is invalid.
func (h *OrderHandler) PlaceOrder(c *fiber.Ctx) error {
	studentID := getStudentID(c)
	if studentID == uuid.Nil {
		return response.ErrorJSON(c, fiber.StatusUnauthorized, "AUTH_001", "authentication required", nil)
	}

	var req service.PlaceOrderRequest
	if err := c.BodyParser(&req); err != nil {
		return response.ErrorJSON(c, fiber.StatusBadRequest, "AUTH_004", "invalid request body", nil)
	}

	if req.PaymentMethod == "" {
		return response.ErrorJSON(c, fiber.StatusBadRequest, "AUTH_004", "payment_method is required", nil)
	}

	order, err := h.orderService.PlaceOrder(c.Context(), studentID, req)
	if err != nil {
		switch err {
		case model.ErrEmptyCart:
			return response.ErrorJSON(c, fiber.StatusBadRequest, "CART_002", "cart is empty", nil)
		case model.ErrInsufficientStock:
			return response.ErrorJSON(c, fiber.StatusBadRequest, "CART_001", "insufficient stock for one or more items", nil)
		case model.ErrBookletNotFound:
			return response.ErrorJSON(c, fiber.StatusBadRequest, "CAT_003", "booklet not found", nil)
		case model.ErrInvalidPayment:
			return response.ErrorJSON(c, fiber.StatusBadRequest, "PAY_002", "invalid payment method, must be 'mercadopago' or 'cash'", nil)
		default:
			return response.ErrorJSON(c, fiber.StatusInternalServerError, "INF_001", "failed to place order", nil)
		}
	}

	return response.SuccessJSON(c, fiber.StatusCreated, order)
}

// ListOrders handles GET /api/orders.
// Returns the authenticated student's orders, paginated (newest first).
func (h *OrderHandler) ListOrders(c *fiber.Ctx) error {
	studentID := getStudentID(c)
	if studentID == uuid.Nil {
		return response.ErrorJSON(c, fiber.StatusUnauthorized, "AUTH_001", "authentication required", nil)
	}

	page, limit := parsePagination(c)

	orders, total, err := h.orderService.ListOrders(c.Context(), studentID, page, limit)
	if err != nil {
		return response.ErrorJSON(c, fiber.StatusInternalServerError, "INF_001", "failed to list orders", nil)
	}

	return response.PaginatedJSON(c, orders, page, limit, total)
}

// GetOrder handles GET /api/orders/:id.
// Returns the order with its items, scoped to the authenticated student.
// Returns 404 if the order is not found or doesn't belong to the student.
func (h *OrderHandler) GetOrder(c *fiber.Ctx) error {
	studentID := getStudentID(c)
	if studentID == uuid.Nil {
		return response.ErrorJSON(c, fiber.StatusUnauthorized, "AUTH_001", "authentication required", nil)
	}

	orderID, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return response.ErrorJSON(c, fiber.StatusBadRequest, "AUTH_004", "invalid order ID", nil)
	}

	detail, err := h.orderService.GetOrder(c.Context(), studentID, orderID)
	if err != nil {
		if err == model.ErrNotFound {
			return response.ErrorJSON(c, fiber.StatusNotFound, "INF_001", "order not found", nil)
		}
		return response.ErrorJSON(c, fiber.StatusInternalServerError, "INF_001", "failed to get order", nil)
	}

	return response.SuccessJSON(c, fiber.StatusOK, detail)
}

// CancelOrder handles POST /api/orders/:id/cancel.
// Cancels the order and restores stock. Only allowed for pending or confirmed orders.
// Returns 409 ORD_002 if the order cannot be cancelled in its current status.
func (h *OrderHandler) CancelOrder(c *fiber.Ctx) error {
	studentID := getStudentID(c)
	if studentID == uuid.Nil {
		return response.ErrorJSON(c, fiber.StatusUnauthorized, "AUTH_001", "authentication required", nil)
	}

	orderID, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return response.ErrorJSON(c, fiber.StatusBadRequest, "AUTH_004", "invalid order ID", nil)
	}

	order, err := h.orderService.CancelOrder(c.Context(), studentID, orderID)
	if err != nil {
		switch err {
		case model.ErrNotFound:
			return response.ErrorJSON(c, fiber.StatusNotFound, "INF_001", "order not found", nil)
		case model.ErrOrderNotCancellable:
			return response.ErrorJSON(c, fiber.StatusConflict, "ORD_002", "order cannot be cancelled in its current status", nil)
		default:
			return response.ErrorJSON(c, fiber.StatusInternalServerError, "INF_001", "failed to cancel order", nil)
		}
	}

	return response.SuccessJSON(c, fiber.StatusOK, order)
}

// ---------- Admin endpoints ----------

// ListAllOrders handles GET /api/admin/orders.
// Returns all orders, paginated. Optional ?status= filter.
func (h *OrderHandler) ListAllOrders(c *fiber.Ctx) error {
	status := c.Query("status")
	page, limit := parsePagination(c)

	orders, total, err := h.orderService.AdminListOrders(c.Context(), status, page, limit)
	if err != nil {
		return response.ErrorJSON(c, fiber.StatusInternalServerError, "INF_001", "failed to list orders", nil)
	}

	return response.PaginatedJSON(c, orders, page, limit, total)
}

// GetOrderAdmin handles GET /api/admin/orders/:id.
// Returns any order with its items (admin — no student scoping).
func (h *OrderHandler) GetOrderAdmin(c *fiber.Ctx) error {
	orderID, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return response.ErrorJSON(c, fiber.StatusBadRequest, "AUTH_004", "invalid order ID", nil)
	}

	detail, err := h.orderService.GetOrderByID(c.Context(), orderID)
	if err != nil {
		if err == model.ErrNotFound {
			return response.ErrorJSON(c, fiber.StatusNotFound, "INF_001", "order not found", nil)
		}
		return response.ErrorJSON(c, fiber.StatusInternalServerError, "INF_001", "failed to get order", nil)
	}

	return response.SuccessJSON(c, fiber.StatusOK, detail)
}

// UpdateOrderStatus handles PUT /api/admin/orders/:id/status.
// Updates the status of an order (e.g., confirmed, shipped, delivered).
func (h *OrderHandler) UpdateOrderStatus(c *fiber.Ctx) error {
	orderID, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return response.ErrorJSON(c, fiber.StatusBadRequest, "AUTH_004", "invalid order ID", nil)
	}

	var req service.UpdateOrderStatusRequest
	if err := c.BodyParser(&req); err != nil {
		return response.ErrorJSON(c, fiber.StatusBadRequest, "AUTH_004", "invalid request body", nil)
	}

	if req.Status == "" {
		return response.ErrorJSON(c, fiber.StatusBadRequest, "AUTH_004", "status is required", nil)
	}

	if err := h.orderService.AdminUpdateOrderStatus(c.Context(), orderID, req.Status); err != nil {
		if err == model.ErrNotFound {
			return response.ErrorJSON(c, fiber.StatusNotFound, "INF_001", "order not found", nil)
		}
		return response.ErrorJSON(c, fiber.StatusInternalServerError, "INF_001", "failed to update order status", nil)
	}

	return response.SuccessJSON(c, fiber.StatusOK, map[string]string{"message": "order status updated"})
}


