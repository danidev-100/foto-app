-- Add 'ready' status to order_status enum
-- Note: PostgreSQL requires a separate transaction to use the new value,
-- so the data migration (UPDATE) must be run separately if needed.
ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'ready';
