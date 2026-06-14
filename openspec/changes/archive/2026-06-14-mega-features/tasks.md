# Tasks: Mega Features — 8 Remaining Features

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~2200–2600 |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | PR 1 → PR 2 → PR 3 → PR 4 → PR 5 |
| Delivery strategy | auto-forecast |
| Chain strategy | stacked-to-main |

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: stacked-to-main
400-line budget risk: High

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | Email utility + Forgot/Reset Password | PR 1 | Base: main. EmailService + ResetToken + auth endpoints + FE pages |
| 2 | Token Refresh + Admin Responsive | PR 2 | Base: main. Auth refresh interceptor + responsive CSS |
| 3 | Payment by Transfer + CSV Export | PR 3 | Base: main. Transfer flow + CSV endpoints |
| 4 | Audit Log + Email Notifications | PR 4 | Base: main. Audit trail + email hooks on events |
| 5 | Test Coverage | PR 5 | Base: main. Backend + frontend tests |

## Phase 1: Foundation (shared infra)

- [x] 1.1 Create `email.service.js` — Nodemailer transporter + `send()` + reset password template
- [x] 1.2 Add SMTP env vars to `backend/src/config.js`
- [x] 1.3 Add `ResetToken`, `RefreshToken`, `AdminLog` models to `schema.prisma`
- [x] 1.4 Create `audit.service.js` — `AuditService.log()` + `list()`

## Phase 2: Feature Implementation

- [x] 2.1 Auth — forgot/reset in `auth.service.js`, controller, routes, `ForgotPassword.jsx`, `ResetPassword.jsx`, `Login.jsx` link
- [x] 2.2 Auth — `generateRefreshToken()` + `refreshAccessToken()`, `POST /refresh`, 401 interceptor in `client.js`, refreshToken in `AuthContext.jsx`
- [x] 2.3 Transfer — accept `'transfer'` in `placeOrder()`, `POST /orders/:id/confirm-transfer`, bank details UI in `Cart.jsx`
- [x] 2.4 CSV — `generateCsv()` in `progress.service.js` + `order.service.js`, `GET /export/*` routes, download buttons in `ContabilidadTab.jsx`
- [x] 2.5 Audit — wire `AuditService.log()` in catalog/order/payment controllers, `GET /logs` route, "Auditoría" tab with Pagination
- [x] 2.6 Email notifications — add HTML templates to `EmailService`, call `send()` on order placed/status change/payment confirmed
- [x] 2.7 Admin responsive — tables→cards below md, hamburger nav, 44px touch targets in `Admin.jsx` + `ContabilidadTab.jsx`

## Phase 3: Testing

- [x] 3.1 Backend — `cart.service.test.js`: add/update/remove/clear/stock/inactive
- [x] 3.2 Backend — `checkout.service.test.js`: order creation, transfer flow
- [x] 3.3 Backend — `payment.service.test.js`: webhook approved/failed/idempotent
- [x] 3.4 Backend — `auth.e2e.test.js`: forgot/reset/refresh scenarios
- [x] 3.5 Frontend — `Catalog.test.jsx`, `Cart.test.jsx`, `Orders.test.jsx`, `Register.test.jsx`
- [x] 3.6 Frontend — `ForgotPassword.test.jsx`, `ResetPassword.test.jsx`
