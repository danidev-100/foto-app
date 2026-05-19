package handler

import (
	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"

	"foto-app/internal/domain/model"
	"foto-app/internal/domain/service"
	"foto-app/pkg/response"
)

// CartHandler exposes HTTP endpoints for the shopping cart domain.
// All endpoints require authentication (AuthMiddleware).
type CartHandler struct {
	cartService *service.CartService
}

// NewCartHandler creates a CartHandler with its service dependency.
func NewCartHandler(cartService *service.CartService) *CartHandler {
	return &CartHandler{cartService: cartService}
}

// ---------- Helpers ----------

// getStudentID extracts the authenticated student's ID from Fiber locals.
// Returns empty UUID if not found (should not happen behind AuthMiddleware).
func getStudentID(c *fiber.Ctx) uuid.UUID {
	idStr, ok := c.Locals("student_id").(string)
	if !ok || idStr == "" {
		return uuid.Nil
	}
	id, err := uuid.Parse(idStr)
	if err != nil {
		return uuid.Nil
	}
	return id
}

// ---------- Cart endpoints ----------

// AddItem handles POST /api/cart/items.
// Adds a booklet to the authenticated student's cart.
// Returns 201 with the updated cart on success.
// Returns 400 CART_001 if stock is insufficient.
// Returns 400 AUTH_004 if validation fails.
// Returns 404 CAT_003 if booklet not found.
func (h *CartHandler) AddItem(c *fiber.Ctx) error {
	studentID := getStudentID(c)
	if studentID == uuid.Nil {
		return response.ErrorJSON(c, fiber.StatusUnauthorized, "AUTH_001", "authentication required", nil)
	}

	var req service.AddCartItemRequest
	if err := c.BodyParser(&req); err != nil {
		return response.ErrorJSON(c, fiber.StatusBadRequest, "AUTH_004", "invalid request body", nil)
	}

	if req.BookletID == "" || req.Quantity <= 0 {
		return response.ErrorJSON(c, fiber.StatusBadRequest, "AUTH_004", "booklet_id and a positive quantity are required", nil)
	}

	cart, err := h.cartService.AddItem(c.Context(), studentID, req)
	if err != nil {
		switch err {
		case model.ErrBookletNotFound:
			return response.ErrorJSON(c, fiber.StatusNotFound, "CAT_003", "booklet not found", nil)
		case model.ErrInsufficientStock:
			return response.ErrorJSON(c, fiber.StatusBadRequest, "CART_001", "insufficient stock", nil)
		case model.ErrValidation:
			return response.ErrorJSON(c, fiber.StatusBadRequest, "AUTH_004", "invalid booklet_id format", nil)
		default:
			return response.ErrorJSON(c, fiber.StatusInternalServerError, "INF_001", "failed to add item to cart", nil)
		}
	}

	return response.SuccessJSON(c, fiber.StatusCreated, cart)
}

// UpdateItem handles PUT /api/cart/items/:booklet_id.
// Updates the quantity for a booklet in the student's cart.
// Returns 200 with the updated cart on success.
// Returns 400 CART_001 if stock is insufficient.
// Returns 400 AUTH_004 if validation fails.
// Returns 404 if the cart or item is not found.
func (h *CartHandler) UpdateItem(c *fiber.Ctx) error {
	studentID := getStudentID(c)
	if studentID == uuid.Nil {
		return response.ErrorJSON(c, fiber.StatusUnauthorized, "AUTH_001", "authentication required", nil)
	}

	bookletID, err := uuid.Parse(c.Params("booklet_id"))
	if err != nil {
		return response.ErrorJSON(c, fiber.StatusBadRequest, "AUTH_004", "invalid booklet ID", nil)
	}

	var req service.UpdateCartItemRequest
	if err := c.BodyParser(&req); err != nil {
		return response.ErrorJSON(c, fiber.StatusBadRequest, "AUTH_004", "invalid request body", nil)
	}

	if req.Quantity <= 0 {
		return response.ErrorJSON(c, fiber.StatusBadRequest, "AUTH_004", "quantity must be a positive integer", nil)
	}

	cart, err := h.cartService.UpdateItem(c.Context(), studentID, bookletID, req)
	if err != nil {
		switch err {
		case model.ErrBookletNotFound:
			return response.ErrorJSON(c, fiber.StatusNotFound, "CAT_003", "booklet not found", nil)
		case model.ErrInsufficientStock:
			return response.ErrorJSON(c, fiber.StatusBadRequest, "CART_001", "insufficient stock", nil)
		case model.ErrNotFound:
			return response.ErrorJSON(c, fiber.StatusNotFound, "INF_001", "cart or item not found", nil)
		case model.ErrValidation:
			return response.ErrorJSON(c, fiber.StatusBadRequest, "AUTH_004", "invalid request", nil)
		default:
			return response.ErrorJSON(c, fiber.StatusInternalServerError, "INF_001", "failed to update cart item", nil)
		}
	}

	return response.SuccessJSON(c, fiber.StatusOK, cart)
}

// RemoveItem handles DELETE /api/cart/items/:booklet_id.
// Removes a booklet from the student's cart.
// Returns 200 with the updated cart on success.
// Returns 404 if the cart or item is not found.
func (h *CartHandler) RemoveItem(c *fiber.Ctx) error {
	studentID := getStudentID(c)
	if studentID == uuid.Nil {
		return response.ErrorJSON(c, fiber.StatusUnauthorized, "AUTH_001", "authentication required", nil)
	}

	bookletID, err := uuid.Parse(c.Params("booklet_id"))
	if err != nil {
		return response.ErrorJSON(c, fiber.StatusBadRequest, "AUTH_004", "invalid booklet ID", nil)
	}

	cart, err := h.cartService.RemoveItem(c.Context(), studentID, bookletID)
	if err != nil {
		if err == model.ErrNotFound {
			return response.ErrorJSON(c, fiber.StatusNotFound, "INF_001", "cart or item not found", nil)
		}
		return response.ErrorJSON(c, fiber.StatusInternalServerError, "INF_001", "failed to remove cart item", nil)
	}

	return response.SuccessJSON(c, fiber.StatusOK, cart)
}

// ClearCart handles DELETE /api/cart.
// Removes all items from the student's cart.
// Returns 200 with success message.
func (h *CartHandler) ClearCart(c *fiber.Ctx) error {
	studentID := getStudentID(c)
	if studentID == uuid.Nil {
		return response.ErrorJSON(c, fiber.StatusUnauthorized, "AUTH_001", "authentication required", nil)
	}

	if err := h.cartService.Clear(c.Context(), studentID); err != nil {
		return response.ErrorJSON(c, fiber.StatusInternalServerError, "INF_001", "failed to clear cart", nil)
	}

	return response.SuccessJSON(c, fiber.StatusOK, map[string]string{"message": "cart cleared"})
}

// GetCart handles GET /api/cart.
// Returns the authenticated student's cart with items and total.
func (h *CartHandler) GetCart(c *fiber.Ctx) error {
	studentID := getStudentID(c)
	if studentID == uuid.Nil {
		return response.ErrorJSON(c, fiber.StatusUnauthorized, "AUTH_001", "authentication required", nil)
	}

	cart, err := h.cartService.GetCart(c.Context(), studentID)
	if err != nil {
		return response.ErrorJSON(c, fiber.StatusInternalServerError, "INF_001", "failed to get cart", nil)
	}

	return response.SuccessJSON(c, fiber.StatusOK, cart)
}
