package model

import "fmt"

// DomainError represents a structured application-level error with a code and message.
type DomainError struct {
	Code    string `json:"code"`
	Message string `json:"message"`
}

func (e *DomainError) Error() string {
	return fmt.Sprintf("[%s] %s", e.Code, e.Message)
}

// NewDomainError creates a new DomainError with the given code and message.
func NewDomainError(code, message string) *DomainError {
	return &DomainError{Code: code, Message: message}
}

// Predefined domain errors organized by module prefix.
var (
	// INF — Infrastructure errors
	ErrNotFound = NewDomainError("INF_001", "resource not found")

	// AUTH — Authentication & authorization errors
	ErrUnauthorized      = NewDomainError("AUTH_001", "authentication required")
	ErrForbidden         = NewDomainError("AUTH_002", "insufficient permissions")
	ErrConflict          = NewDomainError("AUTH_003", "resource already exists")
	ErrValidation        = NewDomainError("AUTH_004", "validation failed")
	ErrInvalidCredentials = NewDomainError("AUTH_005", "invalid email or password")

	// CART — Cart domain errors
	ErrInsufficientStock = NewDomainError("CART_001", "insufficient stock")
	ErrEmptyCart         = NewDomainError("CART_002", "cart is empty")
	ErrMaxQuantity       = NewDomainError("CART_003", "maximum quantity exceeded")
	ErrMaxItems          = NewDomainError("CART_004", "maximum cart items exceeded")

	// ORD — Order domain errors
	ErrInvalidStatus      = NewDomainError("ORD_001", "invalid status transition")
	ErrOrderNotCancellable = NewDomainError("ORD_002", "order cannot be cancelled in current status")

	// PAY — Payment domain errors
	ErrPaymentFailed  = NewDomainError("PAY_001", "payment processing failed")
	ErrInvalidPayment = NewDomainError("PAY_002", "invalid payment method")
)
