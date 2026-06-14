# Full Spec: test-coverage

> **Change**: mega-features — new backend and frontend tests
> **Stack**: Vitest (frontend) + Supertest/Jest (backend)
> **Status**: Draft

## Purpose

Add comprehensive test coverage for existing and new code. Backend: service-layer tests for cart, checkout, payment webhooks, and new auth flows. Frontend: component tests for key pages.

## Requirements

| ID | Description | Priority |
|----|------------|----------|
| TEST-01 | Backend tests SHALL cover `cart.service`: add item, update quantity, remove item, clear cart, stock validation, inactive booklet rejection. | P0 |
| TEST-02 | Backend tests SHALL cover `checkout.service` (order creation): cart-to-order conversion, stock decrement, cart clearing, validation, transfer order flow. | P0 |
| TEST-03 | Backend tests SHALL cover `payment.service` (webhook flows): approved payment, failed payment, refund, idempotency, invalid signature. | P0 |
| TEST-04 | Backend tests SHALL cover auth: forgot-password flow (token creation + email trigger), reset-password (valid/expired/used tokens), token refresh. | P0 |
| TEST-05 | Frontend component tests SHALL render Catalog: loading skeleton, empty catalog, booklet list with items, filter interaction. | P0 |
| TEST-06 | Frontend component tests SHALL render Cart: empty state, item list, quantity update, remove item, checkout button visibility. | P0 |
| TEST-07 | Frontend component tests SHALL render Orders: empty orders, order list, order detail, cancel button (pending only). | P0 |
| TEST-08 | Frontend component tests SHALL render Register: validation errors, successful registration, API error display. | P0 |
| TEST-09 | Frontend component tests SHALL render ForgotPassword and ResetPassword: email input, success message, token validation UI. | P0 |

### Backend Test Scenarios

#### Scenario: Cart service — add item validates stock

- GIVEN a booklet with stock 5
- WHEN `cartService.addItem(studentId, bookletId, 10)`
- THEN it throws `InsufficientStockError`

#### Scenario: Checkout — transfer order created

- GIVEN a cart with 2 items
- WHEN `checkoutService.createOrder(studentId, "transfer")`
- THEN the order has `payment_method: "transfer"` and `payment_status: "pending"`
- AND bank details are included in response

#### Scenario: Payment webhook — idempotent

- GIVEN the same `payment.approved` notification arrives twice
- WHEN `paymentService.processWebhook(notification)` is called the second time
- THEN it returns without modifying the order (idempotent)

#### Scenario: Auth — reset with expired token

- GIVEN a reset token created 2 hours ago
- WHEN `authService.resetPassword(token, newPassword)`
- THEN it throws `TokenExpiredError`
- AND password is NOT updated

### Frontend Test Scenarios

#### Scenario: Cart — empty state

- GIVEN the cart API returns `{ items: [], total: 0 }`
- WHEN the Cart component renders
- THEN it shows an empty state message and a "Ver Catálogo" link

#### Scenario: ForgotPassword — success flow

- GIVEN the ForgotPassword component is rendered
- WHEN the user enters "student@test.com" and submits
- AND the API returns 200
- THEN a success message "Revisá tu email" is shown
- AND the email input is hidden

#### Scenario: Catalog — loading state

- GIVEN the catalog API is loading
- WHEN the Catalog component renders
- THEN it shows the loading skeleton placeholders

### Coverage Targets

| Layer | Target | Scope |
|-------|--------|-------|
| Backend services | ≥70% line coverage | cart, checkout, payment, auth |
| Frontend components | ≥80% line coverage | Catalog, Cart, Orders, Register, ForgotPassword, ResetPassword |
