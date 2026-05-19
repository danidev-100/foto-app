-- 006_alter_payment_events.sql
-- Add mp_payment_id and processed_at columns to payment_events.
-- mp_payment_id stores the actual Mercado Pago payment ID (e.g., "12345678")
-- from data.id in the webhook payload, used for idempotent lookups.
-- processed_at tracks when the event was actually processed (not just stored).

BEGIN;

ALTER TABLE payment_events
    ADD COLUMN IF NOT EXISTS mp_payment_id  VARCHAR(255),
    ADD COLUMN IF NOT EXISTS processed_at   TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_payment_events_mp_payment_id ON payment_events(mp_payment_id);

COMMIT;
