package port

import (
	"context"
	"time"

	"github.com/google/uuid"

	"foto-app/internal/domain/model"
)

// PaymentRepository defines persistence operations for payment transactions.
type PaymentRepository interface {
	// Create persists a new payment record.
	Create(ctx context.Context, p *model.Payment) error

	// FindByOrderID retrieves the payment for a given order.
	// Returns model.ErrNotFound if no payment exists.
	FindByOrderID(ctx context.Context, orderID uuid.UUID) (*model.Payment, error)

	// FindByMPPaymentID retrieves a payment by its Mercado Pago payment ID.
	// Returns model.ErrNotFound if not found.
	FindByMPPaymentID(ctx context.Context, mpPaymentID string) (*model.Payment, error)

	// UpdateStatus changes the payment status and optionally sets paid_at.
	// Returns model.ErrNotFound if the payment does not exist.
	UpdateStatus(ctx context.Context, id uuid.UUID, status string, paidAt *time.Time) error

	// UpsertEvent idempotently inserts a payment_event by event_id (MP notification ID).
	// Returns true if a new row was inserted, false if the event already existed.
	UpsertEvent(ctx context.Context, event *model.PaymentEvent) (bool, error)

	// FindEventByID retrieves a payment_event by its event_id (MP notification ID).
	// Returns nil if not found (no error — callers check for nil).
	FindEventByID(ctx context.Context, eventID string) (*model.PaymentEvent, error)
}
