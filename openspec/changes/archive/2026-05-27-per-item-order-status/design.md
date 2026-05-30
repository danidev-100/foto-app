# Design: Per-Item Order Status

## Technical Approach

Add `OrderItemStatus` enum + `status` column on `OrderItem` with `pending` default. New service method `adminUpdateOrderItemStatus()` mirrors the existing `adminUpdateOrderStatus()` state-machine pattern. Update `cancelOrder()` to skip stock restore for `delivered` items. Frontend renders per-item `ItemStatusBadge` with contextual transition buttons.

## Architecture Decisions

### Decision: Reuse `OrderStatus` enum values vs. new enum

| Option | Tradeoff | Decision |
|--------|----------|----------|
| Reuse `OrderStatus` | Same values, but semantically conflates order vs item lifecycle | ❌ |
| New `OrderItemStatus` enum | Explicit separation, type-safe, can diverge later | ✅ |

**Rationale**: Same values today, but separate enum makes intent clear and future item-only states possible without touching Order.

### Decision: State machine — match Order transitions exactly

Same transitions as `OrderStatus`: `pending→ready→delivered` (forward), `pending/ready→cancelled` (terminal). `delivered` and `cancelled` are terminal for items too.

**Rationale**: Consistency. Admin already knows this model. No reason to introduce a different lifecycle for items.

### Decision: `cancelOrder()` checks item statuses individually

Read each item's status before the transaction, skip `delivered` items during stock restore, set non-delivered items to `cancelled`. If all items are delivered, reject with 409.

**Rationale**: Correctness — you can't return stock that's already been handed over. Spec scenario requires this.

## Data Flow

```
Admin UI ──PUT /admin/orders/:oid/items/:iid/status──→ Controller ──→ Service
  ↑                                                        │              │
  │                                                        │    1. validate item∈order
  │                                                        │    2. validate transition
  │                                                        │    3. update item status
  │                                                        └──────────────┘
  └──────── JSON response with updated item ←───────────────────────────┘
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `backend/prisma/schema.prisma` | Modify | Add `OrderItemStatus` enum + `status` field to `OrderItem` |
| `backend/src/services/order.service.js` | Modify | New `adminUpdateOrderItemStatus()`, update `cancelOrder()` |
| `backend/src/controllers/order.controller.js` | Modify | New `updateOrderItemStatus` handler |
| `backend/src/routes/admin.routes.js` | Modify | Route for `PUT /orders/:orderId/items/:itemId/status` |
| `frontend/src/api/admin.js` | Modify | New `adminUpdateOrderItemStatus()` API function |
| `frontend/src/pages/Admin.jsx` | Modify | `ItemStatusBadge` component + per-item controls in orders table |
| `migrations/016_add_order_item_status.sql` | Create | Raw SQL: `CREATE TYPE` + `ALTER TABLE` |

## Interfaces / Contracts

### Service: `adminUpdateOrderItemStatus(orderId, itemId, newStatus)`

```js
async adminUpdateOrderItemStatus(orderId, itemId, newStatus) → { id, orderId, bookletId, title, quantity, unitPrice, status }
```
- Validates item exists **and** belongs to `orderId` — 404 if not
- Validates transition via same `VALID_TRANSITIONS` map — 409 if invalid
- Returns the updated `OrderItem` row

### Modified: `cancelOrder(studentId, orderId)`

- Reads each item's `status` before entering the transaction
- Under transaction: skip `booklet.updateMany` restore for items where `status === 'delivered'`
- Set non-delivered items to `cancelled`
- If all items are `delivered`, throw `ORD_002` 409

### API: `PUT /admin/orders/:orderId/items/:itemId/status`

**Request**: `{ "status": "ready" }`
**Success 200**: `{ "success": true, "data": { id, orderId, bookletId, title, quantity, unitPrice, status } }`
**Errors**: 400 (missing status), 404 (order/item not found), 409 (invalid transition)

## State Machine

```
pending ──→ ready ──→ delivered   (terminal)
  │            │
  └────→ cancelled                 (terminal)
```

Allowed transitions: `pending→ready`, `pending→cancelled`, `ready→delivered`, `ready→cancelled`. All others → 409.

## Migration

**File**: `migrations/016_add_order_item_status.sql`

```sql
DO $$ BEGIN
  CREATE TYPE "OrderItemStatus" AS ENUM ('pending', 'ready', 'delivered', 'cancelled');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

ALTER TABLE order_items
  ADD COLUMN status "OrderItemStatus" NOT NULL DEFAULT 'pending';
```

No index needed — queries filter by `orderId + itemId` first. `NOT NULL DEFAULT 'pending'` handles existing rows.

## Error Handling

| Condition | HTTP | Code | Message |
|-----------|------|------|---------|
| Missing `status` in body | 400 | `AUTH_004` | `status is required` |
| Invalid enum value | 400 | `AUTH_004` | `invalid status value` |
| Item not found for this order | 404 | `INF_001` | `order item not found` |
| Invalid transition | 409 | `ORD_003` | `cannot transition from 'X' to 'Y'` |
| Cancel: all items delivered | 409 | `ORD_002` | `all items are already delivered, cannot cancel` |

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit (service) | Valid transition flow, invalid transitions, item-not-in-order | Mock Prisma, call `adminUpdateOrderItemStatus()` |
| Unit (service) | `cancelOrder` with mixed statuses (delivered + pending items) | Mock Prisma, verify stock restore skipped for delivered |
| Unit (service) | `cancelOrder` when ALL items delivered → 409 | Verify error thrown |
| Integration | `PUT` endpoint round-trip with auth, valid body, valid transition | Supertest + test DB |
| Integration | `PUT` endpoint error cases (no auth, missing body, item wrong order) | Supertest |
| Frontend | `ItemStatusBadge` renders correct colors per status | Visual + state check |
| Frontend | Transition button triggers API and updates badge | Mock API, verify state change |

## Rollout

- `prisma db push` after migration syncs client
- No feature flag — additive change, all existing items get `pending` status (current implicit behavior)
- Rollback: revert schema + git restore + `DROP TYPE "OrderItemStatus" CASCADE`

## Open Questions

None.
