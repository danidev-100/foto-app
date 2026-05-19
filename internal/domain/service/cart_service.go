package service

import (
	"context"

	"github.com/google/uuid"
	"github.com/shopspring/decimal"

	"foto-app/internal/domain/model"
	"foto-app/internal/domain/port"
)

// ---------- Request types ----------

// AddCartItemRequest carries the fields needed to add a booklet to the cart.
type AddCartItemRequest struct {
	BookletID string `json:"booklet_id"`
	Quantity  int    `json:"quantity"`
}

// UpdateCartItemRequest carries the new quantity for an existing cart item.
type UpdateCartItemRequest struct {
	Quantity int `json:"quantity"`
}

// ---------- Response types ----------

// CartItemResponse represents a single item in the cart response with the total per item.
type CartItemResponse struct {
	ID           uuid.UUID       `json:"id"`
	CartID       uuid.UUID       `json:"cart_id"`
	BookletID    uuid.UUID       `json:"booklet_id"`
	Quantity     int             `json:"quantity"`
	UnitPrice    decimal.Decimal `json:"unit_price"`
	Title        string          `json:"title"`
	ColorType    *string         `json:"color_type,omitempty"`
	DeliveryDays *int            `json:"delivery_days,omitempty"`
	Subtotal     decimal.Decimal `json:"subtotal"`
}

// CartResponse represents the full cart with items and totals.
type CartResponse struct {
	ID        uuid.UUID          `json:"id"`
	StudentID uuid.UUID          `json:"student_id"`
	Items     []CartItemResponse `json:"items"`
	Total     decimal.Decimal    `json:"total"`
}

// ---------- CartService ----------

// CartService implements business logic for the shopping cart domain.
type CartService struct {
	cartRepo    port.CartRepository
	bookletRepo port.BookletRepository
}

// NewCartService creates a CartService with its repository dependencies.
func NewCartService(
	cartRepo port.CartRepository,
	bookletRepo port.BookletRepository,
) *CartService {
	return &CartService{
		cartRepo:    cartRepo,
		bookletRepo: bookletRepo,
	}
}

// AddItem adds a booklet to the student's cart.
// If the student does not have a cart yet, one is created (one cart per student).
// If the booklet is already in the cart, it upserts the quantity.
// The price is snapshotted from the booklet's current_price at add-time.
func (s *CartService) AddItem(ctx context.Context, studentID uuid.UUID, req AddCartItemRequest) (*CartResponse, error) {
	// Parse booklet ID
	bookletID, err := uuid.Parse(req.BookletID)
	if err != nil {
		return nil, model.ErrValidation
	}

	if req.Quantity <= 0 {
		return nil, model.ErrValidation
	}

	// Fetch booklet to validate stock and snapshot price
	booklet, err := s.bookletRepo.FindByID(ctx, bookletID)
	if err != nil {
		if err == model.ErrNotFound {
			return nil, model.ErrBookletNotFound
		}
		return nil, err
	}

	// Validate stock
	if booklet.Stock < req.Quantity {
		return nil, model.ErrInsufficientStock
	}

	// Get or create cart (one cart per student)
	cart, err := s.cartRepo.FindByStudentID(ctx, studentID)
	if err != nil {
		if err != model.ErrNotFound {
			return nil, err
		}
		// Create new cart
		cart = &model.Cart{
			ID:        uuid.New(),
			StudentID: studentID,
		}
		if err := s.cartRepo.Create(ctx, cart); err != nil {
			return nil, err
		}
	}

	// Check if item already exists in cart; if so, update quantity instead
	var existingQuantity int
	existingItems, err := s.cartRepo.GetItems(ctx, cart.ID)
	if err != nil {
		return nil, err
	}
	for _, item := range existingItems {
		if item.BookletID == bookletID {
			existingQuantity = item.Quantity
			break
		}
	}

	if existingQuantity > 0 {
		// Upsert: sum the quantities
		newQty := existingQuantity + req.Quantity
		// Re-validate total quantity against stock
		if booklet.Stock < newQty {
			return nil, model.ErrInsufficientStock
		}
		if err := s.cartRepo.UpdateItem(ctx, cart.ID, bookletID, newQty); err != nil {
			return nil, err
		}
	} else {
		// Add new item with price snapshotted from booklet
		item := &model.CartItem{
			ID:           uuid.New(),
			CartID:       cart.ID,
			BookletID:    bookletID,
			Quantity:     req.Quantity,
			UnitPrice:    booklet.CurrentPrice,
			Title:        booklet.Title,
			ColorType:    nil, // not yet available in booklets schema
			DeliveryDays: nil, // not yet available in booklets schema
		}
		if err := s.cartRepo.AddItem(ctx, item); err != nil {
			return nil, err
		}
	}

	return s.buildCartResponse(ctx, cart.ID, studentID)
}

// UpdateItem updates the quantity for an existing cart item.
// Validates the requested quantity against current stock.
func (s *CartService) UpdateItem(ctx context.Context, studentID uuid.UUID, bookletID uuid.UUID, req UpdateCartItemRequest) (*CartResponse, error) {
	if req.Quantity <= 0 {
		return nil, model.ErrValidation
	}

	// Fetch booklet to validate stock
	booklet, err := s.bookletRepo.FindByID(ctx, bookletID)
	if err != nil {
		if err == model.ErrNotFound {
			return nil, model.ErrBookletNotFound
		}
		return nil, err
	}

	// Validate stock
	if booklet.Stock < req.Quantity {
		return nil, model.ErrInsufficientStock
	}

	// Get student's cart
	cart, err := s.cartRepo.FindByStudentID(ctx, studentID)
	if err != nil {
		if err == model.ErrNotFound {
			return nil, model.ErrNotFound
		}
		return nil, err
	}

	if err := s.cartRepo.UpdateItem(ctx, cart.ID, bookletID, req.Quantity); err != nil {
		if err == model.ErrNotFound {
			return nil, model.ErrNotFound
		}
		return nil, err
	}

	return s.buildCartResponse(ctx, cart.ID, studentID)
}

// RemoveItem removes a booklet from the student's cart.
func (s *CartService) RemoveItem(ctx context.Context, studentID uuid.UUID, bookletID uuid.UUID) (*CartResponse, error) {
	cart, err := s.cartRepo.FindByStudentID(ctx, studentID)
	if err != nil {
		if err == model.ErrNotFound {
			return nil, model.ErrNotFound
		}
		return nil, err
	}

	if err := s.cartRepo.RemoveItem(ctx, cart.ID, bookletID); err != nil {
		if err == model.ErrNotFound {
			return nil, model.ErrNotFound
		}
		return nil, err
	}

	return s.buildCartResponse(ctx, cart.ID, studentID)
}

// Clear deletes all items from the student's cart.
func (s *CartService) Clear(ctx context.Context, studentID uuid.UUID) error {
	cart, err := s.cartRepo.FindByStudentID(ctx, studentID)
	if err != nil {
		if err == model.ErrNotFound {
			return nil // nothing to clear
		}
		return err
	}

	return s.cartRepo.Clear(ctx, cart.ID)
}

// GetCart returns the student's cart with all items and the calculated total.
func (s *CartService) GetCart(ctx context.Context, studentID uuid.UUID) (*CartResponse, error) {
	cart, err := s.cartRepo.FindByStudentID(ctx, studentID)
	if err != nil {
		if err == model.ErrNotFound {
			// Return an empty cart rather than 404
			return &CartResponse{
				StudentID: studentID,
				Items:     []CartItemResponse{},
				Total:     decimal.Zero,
			}, nil
		}
		return nil, err
	}

	return s.buildCartResponse(ctx, cart.ID, studentID)
}

// buildCartResponse assembles a CartResponse from cart items and computes the total.
func (s *CartService) buildCartResponse(ctx context.Context, cartID uuid.UUID, studentID uuid.UUID) (*CartResponse, error) {
	items, err := s.cartRepo.GetItems(ctx, cartID)
	if err != nil {
		return nil, err
	}

	total := decimal.Zero
	itemResponses := make([]CartItemResponse, 0, len(items))

	for _, item := range items {
		subtotal := item.UnitPrice.Mul(decimal.NewFromInt(int64(item.Quantity)))
		total = total.Add(subtotal)

		itemResponses = append(itemResponses, CartItemResponse{
			ID:           item.ID,
			CartID:       item.CartID,
			BookletID:    item.BookletID,
			Quantity:     item.Quantity,
			UnitPrice:    item.UnitPrice,
			Title:        item.Title,
			ColorType:    item.ColorType,
			DeliveryDays: item.DeliveryDays,
			Subtotal:     subtotal,
		})
	}

	return &CartResponse{
		ID:        cartID,
		StudentID: studentID,
		Items:     itemResponses,
		Total:     total,
	}, nil
}
