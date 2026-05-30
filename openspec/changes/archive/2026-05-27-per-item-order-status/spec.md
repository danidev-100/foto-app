# Spec: Per-Item Order Status

> **Change**: Add independent status tracking for each `OrderItem`
> **Stack**: Node.js + Express + Prisma + PostgreSQL
> **Status**: Draft

## 1. Requirements

| ID | Description | Priority |
|---|---|---|
| ITEM-REQ-01 | `OrderItemStatus` enum MUST exist with values: `pending`, `ready`, `delivered`, `cancelled` | P0 |
| ITEM-REQ-02 | `OrderItem.status` column MUST exist with default `pending` -- applies to new AND existing rows | P0 |
| ITEM-REQ-03 | `PUT /admin/orders/:orderId/items/:itemId/status` MUST allow an admin to update a single item's status | P0 |
| ITEM-REQ-04 | Status transitions SHALL follow: `pending->ready->delivered` (forward), `pending/ready->cancelled` (cancel), `delivered->cancelled` SHALL be blocked | P0 |
| ITEM-REQ-05 | The endpoint MUST validate the item belongs to the specified order (404 if not) | P0 |
| ITEM-REQ-06 | `cancelOrder()` MUST skip stock restore for items with status `delivered` | P0 |
| ITEM-REQ-07 | `quantity > 1` moves as a unit -- the entire line item transitions together, not per-unit | P0 |
| ITEM-REQ-08 | Order-level `status` (on `Order` model) SHALL remain manually managed -- NOT auto-derived from items | P0 |
| ITEM-REQ-09 | Frontend Admin orders table MUST display a per-item status badge with transition buttons | P1 |
| ITEM-REQ-10 | Existing student-facing endpoints (`GET /api/orders`, `GET /api/orders/:id`, `POST /api/orders/:id/cancel`) MUST remain unchanged in response shape | P0 |

## 2. Scenarios

### Scenario: Admin advances item status through lifecycle
- GIVEN order "ord-1" has item "item-1" with status `pending`
- WHEN `PUT /admin/orders/ord-1/items/item-1/status` with `{"status": "ready"}`
- THEN status 200
- AND item "item-1" now has status `ready`
- AND other items in the same order remain unchanged
- AND the parent order status is unchanged

### Scenario: Admin delivers an item
- GIVEN item "item-1" has status `ready`
- WHEN updating status to `delivered`
- THEN status 200
- AND item status is `delivered`

### Scenario: Admin cancels a pending item
- GIVEN item "item-1" has status `pending`
- WHEN updating status to `cancelled`
- THEN status 200
- AND item status is `cancelled`

### Scenario: Invalid transition blocked
- GIVEN item "item-1" has status `delivered`
- WHEN updating status to `ready` (going backwards)
- THEN status 409
- AND error indicates invalid transition
- AND item status remains `delivered`

### Scenario: Cancelling delivered item blocked
- GIVEN item "item-1" has status `delivered`
- WHEN updating status to `cancelled`
- THEN status 409
- AND item status remains `delivered`

### Scenario: Item does not belong to the given order
- GIVEN order "ord-1" has item "item-1", and item "item-2" belongs to order "ord-2"
- WHEN `PUT /admin/orders/ord-1/items/item-2/status`
- THEN status 404
- AND error indicates item not found for this order

### Scenario: Order not found
- WHEN `PUT /admin/orders/non-existent/items/item-1/status`
- THEN status 404

### Scenario: Cancel order with mixed item statuses
- GIVEN order "ord-1" has item "item-1" (status `delivered`, qty 2) and item "item-2" (status `pending`, qty 3)
- WHEN student calls `POST /api/orders/ord-1/cancel`
- THEN status 200
- AND order status becomes `cancelled`
- AND item "item-1" remains `delivered` (stock NOT restored for its 2 units)
- AND item "item-2" becomes `cancelled` (stock restored for its 3 units)

### Scenario: Cancel order with all items delivered
- GIVEN order "ord-1" has all items with status `delivered`
- WHEN student calls `POST /api/orders/ord-1/cancel`
- THEN status 409
- AND error indicates no cancellable items remain

### Scenario: Frontend shows per-item status
- GIVEN an admin is viewing the orders table
- AND order "ord-1" has items with different statuses
- WHEN the orders detail view loads
- THEN each item row shows a StatusBadge with the current item status
- AND transition buttons (ready/delivered/cancel) are rendered only for allowed next states
- AND clicking a button triggers the API call and updates that item's badge

## 3. API Contract

### PUT /admin/orders/:orderId/items/:itemId/status

**Auth**: Admin role required (`authMiddleware` + `adminMiddleware`)

**Request body**:
```json
{
  "status": "ready"
}
```

**Success response (200)**:
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "orderId": "uuid",
    "bookletId": "uuid",
    "title": "Matematicas U1",
    "quantity": 2,
    "unitPrice": "150.00",
    "status": "ready"
  }
}
```

**Error responses**:

| Status | Code | When |
|---|---|---|
| 400 | `AUTH_004` | `status` field missing from body |
| 404 | `INF_001` | Order or item not found |
| 409 | `ORD_003` | Invalid status transition (includes message) |
| 401 | -- | No auth token |
| 403 | -- | Non-admin role |

## 4. Validation Rules

| Rule | Enforcement | Behavior |
|---|---|---|
| Valid enum value | Backend (body parse) | Reject with 400 if `status` not in `OrderItemStatus` values |
| Item belongs to order | Backend (service) | `findFirst({ where: { id: itemId, orderId } })` -- 404 if null |
| State machine | Backend (service) | `pending->ready, pending->cancelled, ready->delivered, ready->cancelled`. All others -> 409 |
| `delivered` is terminal | Backend (service) | No transitions out of `delivered` -- not even to `cancelled` |
| `cancelled` is terminal | Backend (service) | No transitions out of `cancelled` |
| Unchanged enum on existing rows | DB (default) | Migration sets `status = 'pending'` for all existing rows |

### State Machine

```
pending ----> ready ----> delivered   (terminal)
  |             |
  +----> cancelled                  (terminal)
```

Same structure as Order status, but with fewer states (no `confirmed` or `in_progress` since item lifecycle starts after payment is confirmed).

## 5. Data Model Changes

### New Enum (Prisma)

```prisma
enum OrderItemStatus {
  pending
  ready
  delivered
  cancelled
}
```

### Modified Model (Prisma)

```prisma
model OrderItem {
  id           String          @id @default(uuid())
  orderId      String          @map("order_id")
  bookletId    String          @map("booklet_id")
  title        String          @db.VarChar(255)
  quantity     Int
  unitPrice    Decimal         @map("unit_price") @db.Decimal(10, 2)
  deliveryDays Int?            @map("delivery_days")
  status       OrderItemStatus @default(pending)
  createdAt    DateTime        @default(now()) @map("created_at")

  order        Order           @relation(fields: [orderId], references: [id], onDelete: Cascade)
  booklet      Booklet         @relation(fields: [bookletId], references: [id])

  @@map("order_items")
}
```

Change: Added `status OrderItemStatus @default(pending)` line.

## 6. Migration Plan

### File: `migrations/016_add_order_item_status.sql`

```sql
-- Create OrderItemStatus enum type
DO $$ BEGIN
  CREATE TYPE "OrderItemStatus" AS ENUM ('pending', 'ready', 'delivered', 'cancelled');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Add status column with default 'pending'
ALTER TABLE order_items
  ADD COLUMN status "OrderItemStatus" NOT NULL DEFAULT 'pending';
```

This migration:
- Creates the enum type idempotently (safe to re-run)
- Adds the column with `NOT NULL DEFAULT 'pending'` -- all existing rows get `pending` automatically
- No data loss or backfill needed
- No index needed -- admin queries filter by order_id + item_id first, then status

### Ordering

Last existing migration: `014_create_pending_checkouts.sql`. Using `016_` to leave room for `015_` from other parallel changes.
