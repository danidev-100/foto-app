# Archive Report: per-item-order-status

> **Change**: Per-Item Order Status — independent status tracking for each OrderItem
> **Mode**: hybrid (openspec files + Engram)
> **Archived**: 2026-05-27
> **Archive location**: `openspec/changes/archive/2026-05-27-per-item-order-status/`

---

## Change Summary

Added independent status tracking for each `OrderItem` via a new `OrderItemStatus` enum (`pending`, `ready`, `delivered`, `cancelled`) and a `status` column on the `OrderItem` model. Admin can now update individual item statuses via `PUT /admin/orders/:orderId/items/:itemId/status`. The `cancelOrder()` service was updated to handle partial delivery — skipping stock restore for `delivered` items. Frontend Admin page renders per-item `ItemStatusBadge` with transition controls.

## What Was Implemented

| Area | File | Description |
|------|------|-------------|
| **Enum + Schema** | `backend/prisma/schema.prisma` | Added `OrderItemStatus` enum with 4 values + `status` field (`OrderItemStatus @default(pending)`) on `OrderItem` model |
| **Migration** | `migrations/016_add_order_item_status.sql` | Idempotent `CREATE TYPE "OrderItemStatus"` + `ALTER TABLE order_items ADD COLUMN status` |
| **Service** | `backend/src/services/order.service.js` | New `adminUpdateOrderItemStatus()` with state-machine validation; updated `cancelOrder()` for partial delivery |
| **Controller** | `backend/src/controllers/order.controller.js` | New `updateOrderItemStatus` handler catching `INF_001` → 404, `ORD_003` → 409 |
| **Route** | `backend/src/routes/admin.routes.js` | `PUT /orders/:orderId/items/:itemId/status` wired to controller |
| **Frontend API** | `frontend/src/api/admin.js` | `adminUpdateOrderItemStatus(orderId, itemId, data)` function |
| **Frontend UI** | `frontend/src/pages/Admin.jsx` | `ItemStatusBadge` component with per-item status display and transition controls |
| **Tests** | `backend/tests/order.service.test.js` | 15 unit tests for service methods |
| **Tests** | `backend/tests/orders.test.js` | 30 integration tests including new endpoint |

## Final Test Results

| Check | Result |
|-------|--------|
| **Tests** | ✅ **4 test files, 59 tests passed, 0 failed** |
| **Backend tests** | ✅ All pass (vitest run, exit code 0) |
| **Frontend build** | ✅ `vite build` succeeds (90 modules, 373.69 KB JS, 56.46 KB CSS) |

## Spec Compliance

All 10 requirements (ITEM-REQ-01 through ITEM-REQ-10) implemented and verified:
- P0 requirements: 9/9 ✅ PASS
- P1 requirement: ITEM-REQ-09 ⚠️ PASS WITH WARNING (frontend UI shows all statuses regardless of current state — backend correctly enforces transitions)

## Known Issues / Remaining Work

### WARNINGS (from verify report)

| ID | Description | Severity |
|----|-------------|----------|
| W1 | `ItemStatusBadge` renders all 4 statuses as `<option>` regardless of current state — should filter by allowed transitions per state machine. UX issue only (backend correctly enforces). File: `frontend/src/pages/Admin.jsx` lines 399-403 | WARNING |
| W2 | `cancelOrder` controller handler at `order.controller.js:51` catches `ORD_002` with hardcoded message "order cannot be cancelled in its current status" instead of using `err.message`. The service throws a specific message ("all items are already delivered, cannot cancel") that's lost. | WARNING |

### SUGGESTIONS

| ID | Description |
|----|-------------|
| S1 | Migration `ALTER TABLE ADD COLUMN` is NOT idempotent — use `ADD COLUMN IF NOT EXISTS` for consistency with the idempotent `CREATE TYPE` |
| S2 | `ItemStatusBadge` could be extracted to its own component file |
| S3 | Missing integration test for "Order not found" (non-existent orderId → 404) |

## Architecture Decisions Preserved

- New `OrderItemStatus` enum (not reusing `OrderStatus`) — explicit separation, can diverge later
- Same state machine as `OrderStatus` — admin consistency (`pending→ready→delivered`, `pending/ready→cancelled`)
- `cancelOrder()` checks item statuses individually — stock only restored for non-delivered items
- Order-level `status` remains manually managed — NOT auto-derived from items
- `quantity > 1` moves as a unit (entire line item transitions together)

## All Files (current state)

```
openspec/changes/per-item-order-status/
├── proposal.md          # Change intent and scope
├── spec.md              # Full specification with requirements, scenarios, API contract
├── design.md            # Technical design and architecture decisions
├── tasks.md             # Implementation tasks (all 11/11 ✅ complete)
├── verify-report.md     # Verification results (PASS WITH WARNINGS)
└── archive-report.md    # This archive report

Source files (implemented):
backend/
├── prisma/schema.prisma                      # Added OrderItemStatus enum + field
├── migrations/016_add_order_item_status.sql   # New migration
└── src/
    ├── services/order.service.js              # adminUpdateOrderItemStatus() + cancelOrder() update
    ├── controllers/order.controller.js        # updateOrderItemStatus handler
    └── routes/admin.routes.js                 # PUT route
frontend/
├── src/api/admin.js                           # adminUpdateOrderItemStatus() function
└── src/pages/Admin.jsx                        # ItemStatusBadge + per-item controls
tests/
├── backend/tests/order.service.test.js        # 15 unit tests
└── backend/tests/orders.test.js               # 30 integration tests
```

## SDD Cycle Complete

The change has been fully planned, proposed, specified, designed, implemented, tested, verified, and archived.
