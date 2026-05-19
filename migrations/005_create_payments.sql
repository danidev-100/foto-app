-- 005_create_payments.sql
-- Create separate payments table for tracking individual payment transactions.
-- While the orders table carries payment_status/payment_method at the aggregate level,
-- the payments table records each payment attempt with its MP-specific details.

BEGIN;

CREATE TABLE IF NOT EXISTS payments (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id            UUID NOT NULL REFERENCES orders(id),
    method              VARCHAR(50) NOT NULL,
    status              VARCHAR(50) NOT NULL DEFAULT 'pending',
    amount              DECIMAL(10,2) NOT NULL,
    mp_payment_id       VARCHAR(255),
    external_reference  VARCHAR(255),
    paid_at             TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT positive_amount CHECK (amount >= 0)
);

CREATE INDEX IF NOT EXISTS idx_payments_order_id ON payments(order_id);
CREATE INDEX IF NOT EXISTS idx_payments_mp_payment_id ON payments(mp_payment_id);

COMMIT;
