-- Create OrderItemStatus enum type
DO $$ BEGIN
  CREATE TYPE "OrderItemStatus" AS ENUM ('pending', 'ready', 'delivered', 'cancelled');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Add status column with default 'pending'
ALTER TABLE order_items
  ADD COLUMN status "OrderItemStatus" NOT NULL DEFAULT 'pending';
