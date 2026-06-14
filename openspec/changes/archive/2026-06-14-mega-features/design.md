# Design: Mega Features — 8 Remaining Features

## Technical Approach

Shared infrastructure (email, audit, token refresh) built first, then feature-specific layers. Each feature adds backend routes + frontend views using existing patterns: class services, Express controllers, `successJSON`/`errorJSON`, Prisma models with `@@map` snake_case tables. All new UIs reuse shared components (Badge, Modal, EmptyState, ToastProvider, Pagination, Loading). Email and audit logging are fire-and-forget — failures logged, never block primary operations.

---

## Architecture Decisions

| Option | Tradeoffs | Decision |
|--------|-----------|----------|
| **Email**: Nodemailer vs SendGrid vs logging only | Nodemailer + Gmail SMTP: free (500/day), zero deps already exist. SendGrid: paid. Logging: no real delivery. | **Nodemailer + Gmail SMTP** — config in `backend/.env` (`SMTP_HOST/PORT/USER/PASS/EMAIL_FROM`), wired in `config.js`. |
| **Reset token storage**: raw vs hashed | Raw: simpler queries, DB leak exposes all tokens. Hashed: secure, extra query step. | **Hashed (SHA-256)** — token sent in URL, SHA-256 hash stored. 1h expiry limits exposure. |
| **Refresh token model**: DB vs long-lived JWT | DB: revocable, auditable. JWT: stateless, no DB hit, can't revoke individually. | **DB model (`RefreshToken`)** — Prisma model, hashed token, 7d expiry. Revocable per-student. |
| **CSV generation**: library vs manual | Library (csv-stringify): edge cases. Manual: zero deps, simple enough for 2 exports. | **Manual string building** — UTF-8 BOM + comma delimiter + quoted strings. |
| **Audit log integration**: middleware vs explicit calls | Middleware: automatic, magic. Explicit: visible, controllable, testable. | **Explicit service calls** — `AuditService.log()` called at known points in services/controllers. |
| **Transfer payment flow**: new endpoint vs reuse `/pay-cash` | Reuse adds conditionals. New endpoint clearer, auditable. | **New `PATCH /api/admin/orders/:id/confirm-transfer`** — mirrors cash but explicit. |
| **Order validation update**: modify `placeOrder` | One-line change to allow `'transfer'` alongside `'cash'`/`'mercadopago'`. | **Accept `'transfer'` in `placeOrder()`** — no new checkout flow needed. |

---

## Per-Feature Design

### A. Forgot/Reset Password

**Data Flow**: `Client → POST /auth/forgot-password {email} → AuthService → prisma.student.findUnique → (if found) crypto.randomBytes(32) → SHA-256 → prisma.resetToken.create → EmailService.send(reset link) → 200 always`. Reset: `Client → POST /auth/reset-password {token, newPassword} → AuthService → SHA-256(token) → find ResetToken → validate (exists, !usedAt, !expired) → bcrypt.hash → update student.passwordHash → mark token usedAt → 200`.

**File Changes**:

| File | Action | Description |
|------|--------|-------------|
| `backend/prisma/schema.prisma` | Modify | Add `ResetToken` model (id, studentId, tokenHash, expiresAt, usedAt?, createdAt) |
| `backend/src/services/email.service.js` | Create | `EmailService` — Nodemailer transporter, `send(to, subject, html)` |
| `backend/src/services/auth.service.js` | Modify | Add `forgotPassword(email)`, `resetPassword(token, newPassword)` |
| `backend/src/controllers/auth.controller.js` | Modify | Add `forgotPassword`, `resetPassword` handlers |
| `backend/src/routes/auth.routes.js` | Modify | Add `POST /forgot-password`, `POST /reset-password` |
| `backend/src/config.js` | Modify | Add SMTP env vars: `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `EMAIL_FROM` |
| `frontend/src/api/auth.js` | Modify | Add `forgotPassword(data)`, `resetPassword(data)` |
| `frontend/src/pages/ForgotPassword.jsx` | Create | Email-only form → success message |
| `frontend/src/pages/ResetPassword.jsx` | Create | Token (from URL param) + new password form |
| `frontend/src/pages/Login.jsx` | Modify | Add "¿Olvidaste tu contraseña?" link |
| `frontend/src/App.jsx` | Modify | Add routes `/forgot-password`, `/reset-password/:token` |

### B. Payment by Transfer

**Data Flow**: `Cart → POST /api/orders {payment_method: "transfer"} → OrderService.placeOrder (now accepts 'transfer') → order created (pending/pending) → response includes bankDetails from config → Cart shows bank info + "Ya transferí" → Admin → PATCH /confirm-transfer → payment_status=paid, status=confirmed`.

**File Changes**:

| File | Action | Description |
|------|--------|-------------|
| `backend/src/services/order.service.js` | Modify | Add `'transfer'` to allowed payment methods |
| `backend/src/controllers/order.controller.js` | Modify | Update error handler — allow transfer in placeOrder |
| `backend/src/routes/admin.routes.js` | Modify | Add `POST /orders/:id/confirm-transfer` (or reuse `pay-cash` pattern) |
| `backend/src/controllers/payment.controller.js` | Modify | Add `confirmTransferPayment` handler |
| `backend/src/services/payment.service.js` | Modify | Add `confirmTransferPayment(orderId)` — mirrors `confirmCashPayment` |
| `frontend/src/pages/Cart.jsx` | Modify | Add "Transferencia Bancaria" button; show bank details post-checkout |
| `frontend/src/api/orders.js` | Modify | Add `placeTransferOrder()`, or reuse `placeOrder()` |

### C. Admin Responsive Mobile

**Data Flow**: Pure CSS/layout — no data flow changes. Breakpoints: `md` (768px) switches tables→cards, hamburger nav. Touch targets ≥44×44px via Tailwind classes.

**File Changes**:

| File | Action | Description |
|------|--------|-------------|
| `frontend/src/pages/Admin.jsx` | Modify | Table rows → card grid below `md`; tab nav → hamburger/dropdown below `md`; all buttons `min-w-[44px] min-h-[44px]` |
| `frontend/src/pages/ContabilidadTab.jsx` | Modify | Same responsive treatment for all tables |

### D. CSV Export

**Data Flow**: `Admin clicks "Descargar CSV" → GET /api/admin/export/progress?format=csv (auth required) → ProgressService.generateCsv() → builds CSV string with UTF-8 BOM → res.set('Content-Type', 'text/csv') + Content-Disposition: attachment`.

**File Changes**:

| File | Action | Description |
|------|--------|-------------|
| `backend/src/services/progress.service.js` | Modify | Add `generateCsv(schoolId?)` returning CSV string |
| `backend/src/services/order.service.js` | Modify | Add `generateOrdersCsv()` returning CSV string |
| `backend/src/routes/admin.routes.js` | Modify | Add `GET /export/progress`, `GET /export/orders` |
| `frontend/src/pages/ContabilidadTab.jsx` | Modify | Add "Descargar CSV" button (anchors with `download` attr) |
| `frontend/src/api/admin.js` | Modify | Add `exportProgressCsv(schoolId)`, `exportOrdersCsv()` |

### E. Audit Log

**Data Flow**: `Admin action (booklet CRUD, order status, payment confirm) → AuditService.log(adminId, action, entity, entityId, details) → prisma.adminLog.create → fire-and-forget (try/catch → console.error on fail)`. Browse: `GET /api/admin/logs?page=&entity=&action= → AuditService.list({page, entity?, action?}) → paginatedJSON`.

**File Changes**:

| File | Action | Description |
|------|--------|-------------|
| `backend/prisma/schema.prisma` | Modify | Add `AdminLog` model (id, adminId FK, action, entity, entityId, details Json, createdAt) |
| `backend/src/services/audit.service.js` | Create | `AuditService.log()`, `AuditService.list()` — Prisma queries |
| `backend/src/controllers/catalog.controller.js` | Modify | Call `AuditService.log()` on booklet/course create/update/delete |
| `backend/src/controllers/order.controller.js` | Modify | Call `AuditService.log()` on status change |
| `backend/src/controllers/payment.controller.js` | Modify | Call `AuditService.log()` on payment confirm (cash + transfer) |
| `backend/src/routes/admin.routes.js` | Modify | Add `GET /logs` |
| `frontend/src/pages/Admin.jsx` | Modify | Add "Auditoría" tab with logs table, search/filter, Pagination component |

### F. Email Notifications

**Data Flow**: `OrderService.placeOrder (cash/transfer) → EmailService.send(student.email, "Pedido recibido", htmlTemplate) → fire-and-forget`. Same pattern for status changes (in OrderService.adminUpdateOrderStatus) and payment confirmations (in PaymentService).

**File Changes**:

| File | Action | Description |
|------|--------|-------------|
| `backend/src/services/email.service.js` | Modify | Add inline HTML template functions: `orderConfirmationHtml(order)`, `statusChangeHtml(order, newStatus)`, `paymentConfirmHtml(order)` |
| `backend/src/services/order.service.js` | Modify | Call `EmailService.send` on order placed (cash/transfer) and status change |
| `backend/src/services/payment.service.js` | Modify | Call `EmailService.send` on `confirmCashPayment`, `confirmTransferPayment`, MP webhook approved |

### G. Token Refresh

**Data Flow**: `Login → AuthService returns { token (15min), refreshToken (7d) } → AuthContext stores both → Axios interceptor: on 401 → catch → queue concurrent requests → POST /auth/refresh {refreshToken} → new JWT → retry all queued → on failure → clear tokens → redirect to login`.

**File Changes**:

| File | Action | Description |
|------|--------|-------------|
| `backend/prisma/schema.prisma` | Modify | Add `RefreshToken` model (id, studentId, tokenHash, expiresAt, createdAt, revokedAt?) |
| `backend/src/services/auth.service.js` | Modify | Add `generateRefreshToken(student)`, `refreshAccessToken(refreshToken)` |
| `backend/src/controllers/auth.controller.js` | Modify | Add `refresh` handler |
| `backend/src/routes/auth.routes.js` | Modify | Add `POST /refresh` (no authMiddleware — uses body token) |
| `frontend/src/api/client.js` | Modify | 401 interceptor: queue, single refresh request, retry, fallback to login |
| `frontend/src/context/AuthContext.jsx` | Modify | Store `refreshToken` in localStorage; include in login/register response |

### H. Test Coverage

| File | Action | Description |
|------|--------|-------------|
| `backend/tests/cart.service.test.js` | Create | Add/update/remove/clear/stock/inactive |
| `backend/tests/checkout.service.test.js` | Create | Order creation, transfer flow |
| `backend/tests/payment.service.test.js` | Create | Webhook approved/failed/idempotent/invalid sig |
| `backend/tests/auth.e2e.test.js` | Create | Forgot/reset/refresh flows |
| `frontend/src/__tests__/Catalog.test.jsx` | Create | Loading, empty, list, filter |
| `frontend/src/__tests__/Cart.test.jsx` | Create | Empty, items, quantity, remove, checkout |
| `frontend/src/__tests__/Orders.test.jsx` | Create | Empty, list, detail, cancel |
| `frontend/src/__tests__/Register.test.jsx` | Create | Validation, success, API error |
| `frontend/src/__tests__/ForgotPassword.test.jsx` | Create | Input, success, validation |
| `frontend/src/__tests__/ResetPassword.test.jsx` | Create | Token UI, validation |

---

## Interfaces / Contracts

### ResetToken (Prisma)
```
model ResetToken {
  id        String    @id @default(uuid())
  studentId String    @map("student_id")
  tokenHash String    @map("token_hash")
  expiresAt DateTime  @map("expires_at")
  usedAt    DateTime? @map("used_at")
  createdAt DateTime  @default(now()) @map("created_at")
  student   Student   @relation(fields: [studentId], references: [id])
  @@map("reset_tokens")
}
```

### RefreshToken (Prisma)
```
model RefreshToken {
  id        String    @id @default(uuid())
  studentId String    @map("student_id")
  tokenHash String    @map("token_hash")
  expiresAt DateTime  @map("expires_at")
  revokedAt DateTime? @map("revoked_at")
  createdAt DateTime  @default(now()) @map("created_at")
  student   Student   @relation(fields: [studentId], references: [id], onDelete: Cascade)
  @@map("refresh_tokens")
}
```

### AdminLog (Prisma)
```
model AdminLog {
  id        String   @id @default(uuid())
  adminId   String   @map("admin_id")
  action    String   @db.VarChar(50)
  entity    String   @db.VarChar(50)
  entityId  String   @map("entity_id")
  details   Json?
  createdAt DateTime @default(now()) @map("created_at")
  @@index([entity])
  @@index([createdAt])
  @@map("admin_logs")
}
```

### EmailService API
```
class EmailService {
  send(to: string, subject: string, html: string): Promise<void>  // fire-and-forget
  // Templates:
  orderConfirmation(order, student, items): string
  statusChangeHtml(order, newStatus): string
  paymentConfirmHtml(order, method): string
  resetPasswordHtml(resetLink): string
}
```

### Auth Endpoint Contracts
```
POST /api/auth/forgot-password  { email }        → 200 { message }
POST /api/auth/reset-password   { token, newPassword } → 200 { message } | 400 TOKEN_EXPIRED/INVALID
POST /api/auth/refresh          { refreshToken }  → 200 { token, refreshToken? } | 401
POST /api/auth/login            { email, password } → 200 { token, refreshToken, student }
```

---

## Testing Strategy

| Layer | What | Approach |
|-------|------|----------|
| Unit | CartService, CheckoutService, AuthService | Mock Prisma, test business logic |
| Unit | PaymentService webhook | Mock MP gateway, test status mapping + idempotency |
| Integration | Auth (forgot/reset/refresh) | Supertest + real Prisma test DB or transactions |
| Unit | EmailService | Mock Nodemailer, test template output |
| Component | Catalog, Cart, Orders, Register, ForgotPassword | @testing-library/react, mock API client |
| Component | Admin (Auditoría tab) | Mock logs API, test pagination + filter |
| E2E | Transfer payment flow | Cypress/Playwright (future — out of scope for this change) |

**Coverage targets**: Backend services ≥70%, Frontend components ≥80%.

---

## Migration / Rollout

No data migration required. `prisma db push` handles new models. Each feature is gated by its own route — deploy independently. Token refresh coexists with old tokens (old login still works, no refreshToken returned until login).

---

## Open Questions

- [ ] Gmail SMTP creds: does the client have a Gmail account for the school, or should we design for SendGrid fallback?
- [ ] Refresh token rotation: issue new refresh token on each refresh (rotation) or keep the same? Rotation is more secure but complicates concurrent requests.
- [ ] CSV export from ContabilidadTab: filter by current school filter selection, or always export all?
- [ ] MP webhook email: does the existing `_completeCheckout` flow trigger email, or do we add it inside `handleMPWebhook`?
