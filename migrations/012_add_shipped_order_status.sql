-- Add the 'shipped' status to the OrderStatus enum
-- This represents "Entregado" (delivered to school but not yet picked up by student)
-- Flow: pending → ready → shipped → delivered
ALTER TYPE "OrderStatus" ADD VALUE IF NOT EXISTS 'shipped';
