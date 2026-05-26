-- Create pending_checkouts table for MP two-phase checkout
-- Orders are NOT created until MP confirms payment via webhook.
-- This prevents orders from appearing when payment fails.

CREATE TABLE IF NOT EXISTS pending_checkouts (
  id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL REFERENCES students(id),
  total DECIMAL(10,2) NOT NULL,
  items JSONB NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'pending',
  mp_preference_id VARCHAR(255),
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pending_checkouts_student_id ON pending_checkouts(student_id);
CREATE INDEX IF NOT EXISTS idx_pending_checkouts_status ON pending_checkouts(status);
