# Proposal: Mega Features — 8 Remaining Features for FotoApp

## Intent

Complete the remaining features across auth, payment, admin UX, notifications, audit, and testing. The app is functional (orders, catalog, cart, contabilidad) but lacks password recovery, transfer payment flow, mobile-responsive admin, CSV export, audit trail, email notifications, token refresh, and adequate test coverage.

## Scope

### In Scope
1. **Forgot/Reset Password**: POST `/api/auth/forgot-password`, POST `/api/auth/reset-password`, ForgotPassword + ResetPassword pages, Nodemailer + Gmail SMTP.
2. **Payment by Transfer**: Transfer flow UI (show bank details post-checkout), admin confirmation of transfers, reuses existing `getBankDetails` endpoint and `PaymentMethod.transfer` enum.
3. **Admin Responsive Mobile**: Tables → card layouts on small screens, hamburger menu for tab nav, better touch targets. No spec changes — pure implementation.
4. **CSV Export**: `GET /api/admin/export/progress?format=csv` endpoint + download button in ContabilidadTab.
5. **Audit Log**: `AdminLog` model (adminId, action, entity, entityId, details, createdAt), middleware/service wrapper for admin ops, admin browse view.
6. **Email Notifications**: On order placed (cash) → student, order status change → student, payment confirmed → student. Reuses forgot-password email infra.
7. **Token Refresh**: `POST /api/auth/refresh` endpoint + frontend 401 interceptor in `api/client.js` that auto-refreshes before redirecting to login.
8. **Better Test Coverage**: Cart, checkout, webhook, payment backend tests. Catalog, Cart, Orders, Register frontend tests. Integration tests.

### Out of Scope
- Registration with course/school (user declined)
- Image upload (user declined)
- SMS/WhatsApp notifications (email-only)
- Third-party auth providers (Google, etc.)

## Capabilities

### New Capabilities
- `auth`: Extended with forgot-password, reset-password, token-refresh flows.
- `payment-transfer`: Bank transfer payment flow with admin confirmation.
- `csv-export`: Server-side CSV generation and download.
- `admin-log`: Audit trail tracking admin CRUD operations.
- `email-notifications`: Transactional emails for orders and payments.

### Modified Capabilities
- None. All existing specs unchanged at the requirement level.

## Approach

Implement in order: (1) email infra + forgot password, (2) token refresh, (3) email notifications, (4) transfer payment, (5) admin mobile responsive, (6) CSV export, (7) audit log, (8) test coverage. Each adds backend routes + frontend views. All new UIs use the shared component library (Modal, Badge, EmptyState, Loading, ToastProvider, Pagination). Nodemailer for email (zero new deps — already in package.json? No, need to add `nodemailer`).

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `backend/prisma/schema.prisma` | Modified | Add `AdminLog`, `ResetToken` models. Add `confirmed` to OrderStatus? No—already have confirmed flow via pay-cash. |
| `backend/src/routes/auth.routes.js` | Modified | Add forgot-password, reset-password, refresh routes |
| `backend/src/routes/admin.routes.js` | Modified | Add confirm-transfer, export, audit-log routes |
| `backend/src/services/*` | Modified | New services: `email.service.js`, `audit.service.js` |
| `backend/src/controllers/*` | Modified | New controllers for each feature |
| `backend/src/middleware/auth.js` | Modified | Add refresh token verification |
| `backend/src/app.js` | Modified | Register new routes |
| `backend/src/config.js` | Modified | Add email SMTP + refresh token config |
| `frontend/src/pages/Login.jsx` | Modified | Add "Forgot password?" link |
| `frontend/src/pages/ForgotPassword.jsx` | **New** | Email input → success message |
| `frontend/src/pages/ResetPassword.jsx` | **New** | Token + new password form |
| `frontend/src/pages/Admin.jsx` | Modified | Responsive layout, hamburger menu |
| `frontend/src/pages/Cart.jsx` | Modified | Transfer option in checkout |
| `frontend/src/pages/ContabilidadTab.jsx` | Modified | CSV download button |
| `frontend/src/api/client.js` | Modified | 401 interceptor with token refresh |
| `frontend/src/api/auth.js` | Modified | Add forgot/reset/refresh API calls |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Gmail SMTP rate limits (500/day) | Low | Batch notifications; log failures |
| Token refresh race condition | Med | Queue concurrent 401 retries; single refresh at a time |
| Mobile admin layout breaks existing flows | Med | Responsive-only changes; test on real mobile viewports |

## Rollback Plan

1. Each feature is a separate PR — revert per-feature if needed.
2. Email: if SMTP fails, orders still succeed — notifications are fire-and-forget.
3. Token refresh: revert to old 401 handler (redirect to login).
4. Responsive admin: revert CSS-only changes.

## Dependencies

- `nodemailer` npm package (new dependency)
- Gmail SMTP credentials in env vars

## Success Criteria

- [ ] Forgot password sends email with reset link → token validates
- [ ] Transfer payment shows bank details → admin can confirm
- [ ] Admin pages render without horizontal scroll on 375px viewport
- [ ] CSV download produces valid CSV with all progress columns
- [ ] AdminLog records every admin create/update/delete
- [ ] Email sent on order placed, status change, payment confirmed
- [ ] Token refresh extends session without re-login
- [ ] Test coverage: backend ≥70%, frontend component tests for all new pages
