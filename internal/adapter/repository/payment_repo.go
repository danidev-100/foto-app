package repository

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"foto-app/internal/domain/model"
)

// PaymentRepo implements port.PaymentRepository using pgx.
type PaymentRepo struct {
	pool *pgxpool.Pool
}

// NewPaymentRepo creates a new pgx-backed PaymentRepo.
func NewPaymentRepo(pool *pgxpool.Pool) *PaymentRepo {
	return &PaymentRepo{pool: pool}
}

// Create persists a new payment record.
func (r *PaymentRepo) Create(ctx context.Context, p *model.Payment) error {
	query := `INSERT INTO payments (id, order_id, method, status, amount, mp_payment_id, external_reference, paid_at)
	           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`
	_, err := r.pool.Exec(ctx, query,
		p.ID, p.OrderID, p.Method, p.Status, p.Amount,
		p.MPPaymentID, p.ExternalReference, p.PaidAt,
	)
	if err != nil {
		return fmt.Errorf("insert payment: %w", err)
	}
	return nil
}

// FindByOrderID retrieves the payment for a given order.
func (r *PaymentRepo) FindByOrderID(ctx context.Context, orderID uuid.UUID) (*model.Payment, error) {
	query := `SELECT id, order_id, method, status, amount, mp_payment_id, external_reference,
	           paid_at, created_at, updated_at
	           FROM payments WHERE order_id = $1`
	row := r.pool.QueryRow(ctx, query, orderID)
	return scanPayment(row)
}

// FindByMPPaymentID retrieves a payment by its Mercado Pago payment ID.
func (r *PaymentRepo) FindByMPPaymentID(ctx context.Context, mpPaymentID string) (*model.Payment, error) {
	query := `SELECT id, order_id, method, status, amount, mp_payment_id, external_reference,
	           paid_at, created_at, updated_at
	           FROM payments WHERE mp_payment_id = $1`
	row := r.pool.QueryRow(ctx, query, mpPaymentID)
	return scanPayment(row)
}

// UpdateStatus changes the payment status and optionally sets paid_at.
func (r *PaymentRepo) UpdateStatus(ctx context.Context, id uuid.UUID, status string, paidAt *time.Time) error {
	query := `UPDATE payments SET status = $1, paid_at = COALESCE($2, paid_at), updated_at = NOW() WHERE id = $3`
	tag, err := r.pool.Exec(ctx, query, status, paidAt, id)
	if err != nil {
		return fmt.Errorf("update payment status: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return model.ErrNotFound
	}
	return nil
}

// UpsertEvent idempotently inserts a payment_event by event_id (MP notification ID).
// Returns true if a new row was inserted, false if the event already existed.
func (r *PaymentRepo) UpsertEvent(ctx context.Context, event *model.PaymentEvent) (bool, error) {
	rawBody := []byte("null")
	if event.RawBody != nil {
		rawBody = event.RawBody
	}

	tag, err := r.pool.Exec(ctx, `
		INSERT INTO payment_events (id, order_id, event_id, topic, action, mp_payment_id, raw_body, processed, created_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, FALSE, NOW())
		ON CONFLICT (event_id) DO NOTHING
	`, event.ID, event.OrderID, event.EventID, event.Topic, event.Action, event.MPPaymentID, rawBody)
	if err != nil {
		return false, fmt.Errorf("upsert payment_event: %w", err)
	}

	if tag.RowsAffected() > 0 {
		event.Processed = false
		return true, nil // new event
	}

	// Event already existed — read existing data
	existing, err := r.FindEventByID(ctx, event.EventID)
	if err != nil {
		return false, fmt.Errorf("find existing event: %w", err)
	}
	if existing != nil {
		event.Processed = existing.Processed
		event.ID = existing.ID
	}
	return false, nil // duplicate event
}

// FindEventByID retrieves a payment_event by its event_id (MP notification ID).
func (r *PaymentRepo) FindEventByID(ctx context.Context, eventID string) (*model.PaymentEvent, error) {
	query := `SELECT id, order_id, event_id, topic, action, mp_payment_id, raw_body, processed, created_at
	           FROM payment_events WHERE event_id = $1`
	row := r.pool.QueryRow(ctx, query, eventID)

	var ev model.PaymentEvent
	var rawBody []byte
	err := row.Scan(
		&ev.ID, &ev.OrderID, &ev.EventID, &ev.Topic, &ev.Action,
		&ev.MPPaymentID, &rawBody, &ev.Processed, &ev.CreatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		}
		return nil, fmt.Errorf("scan payment_event: %w", err)
	}
	ev.RawBody = rawBody
	return &ev, nil
}

// -- scan helpers --

func scanPayment(row pgx.Row) (*model.Payment, error) {
	var p model.Payment
	err := row.Scan(
		&p.ID, &p.OrderID, &p.Method, &p.Status, &p.Amount,
		&p.MPPaymentID, &p.ExternalReference, &p.PaidAt, &p.CreatedAt, &p.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, model.ErrNotFound
		}
		return nil, fmt.Errorf("scan payment: %w", err)
	}
	return &p, nil
}


