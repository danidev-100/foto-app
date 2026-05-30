# Proposal: Per-Item Order Status

## Intent

Admin cannot mark individual booklets ready/delivered — must change the entire order. This breaks the real-world flow where students collect booklets one at a time.

## Scope

### In Scope
- `OrderItemStatus` enum + `status` column on `OrderItem` (default `pending`)
- Backend: admin endpoint `PUT /admin/orders/:orderId/items/:itemId/status`
- Service method `adminUpdateOrderItemStatus()` + update `cancelOrder()` for partial delivery
- Controller handler + route wiring
- Frontend: per-item StatusBadge in Admin orders table
- API function in `frontend/src/api/admin.js`
- Raw SQL migration (`016_add_order_item_status.sql`)
- Test suite for new endpoint and cancellation logic

### Out of Scope
- Aggregating Order status from items (Order remains manually managed)
- Student-facing per-item status views
- Per-unit tracking (status at OrderItem level, not per-quantity-unit)
- Notifications/events on item status change
- Bulk status updates UI

## Capabilities

### New Capabilities
- `per-item-order-status`: OrderItem-level lifecycle tracking with its own status enum (`pending`, `ready`, `delivered`, `cancelled`) and independent transitions from parent Order.

### Modified Capabilities
- None. Order-level status flow and all existing endpoints remain unchanged.

## Approach

1. Add `OrderItemStatus` enum and `status` column (default `pending`) to Prisma schema
2. Write raw SQL migration `016_add_order_item_status.sql`
3. Add `adminUpdateOrderItemStatus()` to order service — validates item belongs to order, enforces valid state transitions
4. Update `cancelOrder()` — skip stock restore for delivered items
5. Wire `PUT /admin/orders/:orderId/items/:itemId/status` via controller and admin routes
6. Frontend: add `adminUpdateOrderItemStatus()` API call, render per-item StatusBadge in Admin.jsx orders table with individual transition buttons

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `backend/prisma/schema.prisma` | Modified | Add `OrderItemStatus` enum + `status` field on OrderItem |
| `backend/src/services/order.service.js` | Modified | New method + cancel logic for partial delivery |
| `backend/src/controllers/order.controller.js` | Modified | New `updateOrderItemStatus` handler |
| `backend/src/routes/admin.routes.js` | Modified | New route definition |
| `frontend/src/api/admin.js` | Modified | New `adminUpdateOrderItemStatus()` |
| `frontend/src/pages/Admin.jsx` | Modified | Per-item status + transition buttons |
| `migrations/016_add_order_item_status.sql` | New | Raw SQL: ALTER TABLE + CREATE TYPE |
| `backend/tests/orders.test.js` | Modified | Tests for new flow + cancel edge case |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Prisma schema + raw SQL out of sync | Med | Run migration first, then sync via `prisma db push` |
| Cancel with mixed delivered/pending items | Low | Unit tests covering all cancellation scenarios |
| Frontend re-render perf on large orders | Low | Single local state update per item, no extra API calls |

## Rollback Plan

- Revert Prisma schema, restore from git
- Run rollback SQL (`DROP TYPE IF EXISTS "OrderItemStatus" CASCADE`)
- Restore service, controller, routes, frontend from git
- No data loss — new column defaults to `pending` (current implicit behavior)

## Dependencies

- Migration numbering follows existing scheme (`016_`)
- Admin auth middleware is already in place

## Success Criteria

- [ ] Admin can update individual OrderItem status via API with valid transitions
- [ ] Frontend renders per-item status badge with transition buttons
- [ ] Cancelling an order with delivered items skips stock restore for those items
- [ ] All existing tests pass; new endpoint and cancel logic have coverage
- [ ] Status transitions enforce valid state machine (pending → ready → delivered; any → cancelled)
