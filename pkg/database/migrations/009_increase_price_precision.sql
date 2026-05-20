-- 009_increase_price_precision.sql
-- Increase DECIMAL precision for price columns to support larger values.
-- DECIMAL(10,2) maxed out at $99,999,999.99 which is too small for cent-based storage.
-- DECIMAL(14,2) supports up to $99,999,999,999.99.

BEGIN;

ALTER TABLE booklets ALTER COLUMN current_price TYPE DECIMAL(14,2);
ALTER TABLE cart_items ALTER COLUMN unit_price TYPE DECIMAL(14,2);
ALTER TABLE orders ALTER COLUMN total TYPE DECIMAL(14,2);
ALTER TABLE order_items ALTER COLUMN unit_price TYPE DECIMAL(14,2);

COMMIT;
