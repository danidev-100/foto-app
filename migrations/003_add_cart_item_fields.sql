-- 003_add_cart_item_fields.sql
-- Add denormalized display fields to cart_items for snapshot-at-add-time consistency.
-- Title is available now; color_type and delivery_days will be populated once
-- they exist on the booklets table (future migration).

BEGIN;

ALTER TABLE cart_items
    ADD COLUMN IF NOT EXISTS title          VARCHAR(255) NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS color_type     VARCHAR(50),
    ADD COLUMN IF NOT EXISTS delivery_days  INTEGER;

COMMIT;
