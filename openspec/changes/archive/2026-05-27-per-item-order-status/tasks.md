# Tasks: Per-Item Order Status

## Review Workload Forecast

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: size-exception
400-line budget risk: Low

Estimated changed lines: ~290

## Phase 1: Data Layer

- [x] 1.1 **Prisma schema** — Add `OrderItemStatus` enum (`pending`, `ready`, `delivered`, `cancelled`) + `status` field (`OrderItemStatus @default(pending)`) on `OrderItem` model. File: `backend/prisma/schema.prisma`.
- [x] 1.2 **Migration** — Create `migrations/016_add_order_item_status.sql` with idempotent `CREATE TYPE "OrderItemStatus"` + `ALTER TABLE order_items ADD COLUMN status`.

## Phase 2: Service Layer

- [x] 2.1 **New method `adminUpdateOrderItemStatus()`** — Add to `OrderService` in `backend/src/services/order.service.js`. Validates item belongs to order (404), validates transition via `VALID_TRANSITIONS` map (409), updates item. Uses same transition rules as Order: `pending→ready`, `pending/ready→cancelled`, `ready→delivered`. Terminal states reject all transitions.
- [x] 2.2 **Update `cancelOrder()`** — Before transaction, read all item statuses. Skip stock restore for `delivered` items. Set only non-delivered items to `cancelled`. If all items are `delivered`, throw 409. File: `backend/src/services/order.service.js`.

## Phase 3: Controller & Routes

- [x] 3.1 **Controller handler `updateOrderItemStatus`** — New method on `OrderController` in `backend/src/controllers/order.controller.js`. Reads `status` from body (400 if missing), calls service. Handles `INF_001`→404, `ORD_003`→409.
- [x] 3.2 **Route** — Add `PUT /orders/:orderId/items/:itemId/status` to `backend/src/routes/admin.routes.js`, wired to new controller handler. Auth inherited from admin middleware.

## Phase 4: Frontend API Client

- [x] 4.1 **API function** — Add `adminUpdateOrderItemStatus(orderId, itemId, data)` to `frontend/src/api/admin.js`. Calls `PUT /admin/orders/${orderId}/items/${itemId}/status`.

## Phase 5: Frontend UI

- [x] 5.1 **`ItemStatusBadge` + per-item controls in Admin.jsx** — Import new API function. Create `ItemStatusBadge` component (inline or extracted) with colored badge + transition buttons for allowed next states. Add `handleUpdateItemStatus(orderId, itemId, newStatus)` handler. Replace flat item lists in 3 table sections (search-by-ID, search-by-student, all-orders) with per-item status badges. File: `frontend/src/pages/Admin.jsx`.

## Phase 6: Tests

- [x] 6.1 **Service unit tests** — Add `describe('adminUpdateOrderItemStatus')` and extend `describe('Cancel order')` in `backend/tests/orders.test.js`. Cover: valid transitions, invalid transitions (409), item not in order (404), cancel order with mixed item statuses, cancel order with all items delivered (409).
- [x] 6.2 **Integration tests** — Add `describe('PUT /admin/orders/:orderId/items/:itemId/status')` in `backend/tests/orders.test.js`. Cover: round-trip update, missing body field (400), auth guard (401), non-admin (403).

## Implementation Order

Data layer first (1.1 → 1.2) so Prisma client regenerates with the new type. Then service layer (2.1 → 2.2) because controllers depend on it. Controller + route next (3.1 → 3.2). Frontend API ↔ UI last (4.1 → 5.1). Tests validate the whole chain (6.1 → 6.2).
