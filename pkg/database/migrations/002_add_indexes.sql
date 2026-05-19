-- 002_add_indexes.sql
-- Performance indexes for the Booklet Ordering Application.
-- Separated from 001_init.sql for clarity — applied after the base schema.

BEGIN;

-- Students
CREATE INDEX IF NOT EXISTS idx_students_email ON students(email);
CREATE INDEX IF NOT EXISTS idx_students_course_id ON students(course_id);

-- Divisions
CREATE INDEX IF NOT EXISTS idx_divisions_course_id ON divisions(course_id);

-- Booklets
CREATE INDEX IF NOT EXISTS idx_booklets_course_id ON booklets(course_id);
CREATE INDEX IF NOT EXISTS idx_booklets_division_id ON booklets(division_id);
CREATE INDEX IF NOT EXISTS idx_booklets_active_stock ON booklets(is_active, stock)
    WHERE is_active = true AND stock > 0;

-- Cart items
CREATE INDEX IF NOT EXISTS idx_cart_items_cart_id ON cart_items(cart_id);
CREATE INDEX IF NOT EXISTS idx_cart_items_booklet_id ON cart_items(booklet_id);

-- Orders
CREATE INDEX IF NOT EXISTS idx_orders_student_id ON orders(student_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_payment_status ON orders(payment_status);

-- Order items
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);

-- Payment events
CREATE INDEX IF NOT EXISTS idx_payment_events_order_id ON payment_events(order_id);
CREATE INDEX IF NOT EXISTS idx_payment_events_event_id ON payment_events(event_id);

COMMIT;
