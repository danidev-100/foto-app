-- Add printed_quantity column to booklets table
ALTER TABLE booklets
  ADD COLUMN printed_quantity INTEGER NOT NULL DEFAULT 0;
