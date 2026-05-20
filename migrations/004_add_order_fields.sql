-- 004_add_order_fields.sql
-- Add delivery tracking fields to orders and order_items.
-- delivery_date: calculated as NOW() + MAX(delivery_days) from order items at order time.
-- delivery_days: snapshot from the booklet at order time.

BEGIN;

ALTER TABLE orders
    ADD COLUMN IF NOT EXISTS delivery_date TIMESTAMPTZ;

ALTER TABLE order_items
    ADD COLUMN IF NOT EXISTS delivery_days INTEGER;

COMMIT;
