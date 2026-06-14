# Full Spec: admin-audit-log

> **Change**: mega-features — audit trail for admin operations
> **Stack**: Node.js + Express + Prisma + PostgreSQL
> **Status**: Draft

## Purpose

Track all significant admin actions (CRUD on booklets, courses, order status changes, payment confirmations) in an `AdminLog` table. Provide an admin view to browse the audit trail.

## Requirements

| ID | Description | Priority |
|----|------------|----------|
| AUD-01 | An `AdminLog` model SHALL exist with fields: `id` (UUID), `adminId` (FK → Student), `action` (String), `entity` (String), `entityId` (String), `details` (JSON), `createdAt`. | P0 |
| AUD-02 | An `AuditService` SHALL expose `log(adminId, action, entity, entityId, details)` that creates an `AdminLog` record. | P0 |
| AUD-03 | The audit service SHALL be called on: create/update/delete booklet, create/update/delete course, order status changes, payment confirmations. | P0 |
| AUD-04 | `GET /api/admin/logs` SHALL return paginated audit log entries, ordered by `createdAt` DESC, filterable by `entity` and `action`. | P0 |
| AUD-05 | The admin panel SHALL have a "Auditoría" tab showing the log with columns: admin, action, entity, timestamp. | P0 |
| AUD-06 | Audit logging SHALL be fire-and-forget — failure to log SHALL NOT block the primary operation. | P1 |

### Scenario: Log booklet creation

- GIVEN admin "a-1" creates a booklet
- WHEN `POST /api/admin/booklets` succeeds
- THEN an `AdminLog` record is created with `action: "create"`, `entity: "booklet"`, `entityId: <new booklet id>`, `adminId: "a-1"`, and `details` containing the booklet title

### Scenario: Log order status change

- GIVEN admin "a-1" changes order "ord-123" from "pending" to "confirmed"
- WHEN `PATCH /api/admin/orders/ord-123/status` succeeds
- THEN an `AdminLog` is created with `action: "update_status"`, `entity: "order"`, `entityId: "ord-123"`, and `details` containing `{ "from": "pending", "to": "confirmed" }`

### Scenario: Log payment confirmation

- GIVEN admin "a-1" confirms a transfer payment for order "ord-456"
- WHEN `PATCH /api/admin/orders/ord-456/confirm-transfer` succeeds
- THEN an `AdminLog` is created with `action: "confirm_payment"`, `entity: "order"`, `entityId: "ord-456"`, and `details` containing `{ "method": "transfer" }`

### Scenario: Browse audit log

- GIVEN 50 AdminLog records exist
- WHEN `GET /api/admin/logs?page=1` with valid admin token
- THEN status 200 with 20 paginated entries
- AND entries sorted by `createdAt` descending
- AND each entry has: adminId, action, entity, entityId, details, createdAt

### Scenario: Filter audit log by entity

- GIVEN logs for "booklet" and "order" entities exist
- WHEN `GET /api/admin/logs?entity=booklet`
- THEN only booklet-related entries are returned

### Scenario: Audit log requires admin

- WHEN `GET /api/admin/logs` without auth
- THEN status 401

## Audit Actions

| Action | Trigger | Details |
|--------|---------|---------|
| `create` | Booklet/course created | `{ "title": "..." }` |
| `update` | Booklet/course updated | `{ "changes": { "field": ["old","new"] } }` |
| `delete` | Booklet/course deleted | `{ "title": "..." }` |
| `update_status` | Order status change | `{ "from": "pending", "to": "confirmed" }` |
| `confirm_payment` | Payment confirmed | `{ "method": "cash|transfer" }` |
