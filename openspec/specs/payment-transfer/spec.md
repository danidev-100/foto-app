# Full Spec: payment-transfer

> **Change**: mega-features — bank transfer payment flow
> **Stack**: Node.js + Express + Prisma + PostgreSQL
> **Status**: Draft

## Purpose

Enable students to pay by bank transfer. After checkout, the student sees bank account details and the order is created as pending. Admin confirms the transfer (analogous to the existing cash confirmation flow).

## Requirements

| ID | Description | Priority |
|----|------------|----------|
| PAY-TRF-01 | `POST /api/orders` SHALL accept `payment_method: "transfer"`. The order SHALL be created with `payment_status: "pending"` and `status: "pending"`. | P0 |
| PAY-TRF-02 | The checkout response SHALL include `bankDetails` (account name, CBU/alias, bank name, holder) from the existing `getBankDetails` endpoint/data. | P0 |
| PAY-TRF-03 | `PATCH /api/admin/orders/:id/confirm-transfer` SHALL update `payment_status` to `paid` and `status` to `confirmed` (same semantics as cash confirmation). | P0 |
| PAY-TRF-04 | Frontend Cart.jsx SHALL show a "Transferencia Bancaria" option in checkout buttons alongside existing "Efectivo" and "Mercado Pago". | P0 |
| PAY-TRF-05 | After selecting transfer and confirming, the frontend SHALL display bank account details with the order confirmation and instructions to make the transfer. | P0 |
| PAY-TRF-06 | Admin orders view SHALL show a "Confirmar Transferencia" button for orders with `payment_method: "transfer"` and `payment_status: "pending"`. | P0 |

### Scenario: Student selects transfer payment

- GIVEN student has items in cart
- WHEN `POST /api/orders` with `{"payment_method": "transfer"}`
- THEN status 201
- AND the order has `payment_method: "transfer"`, `payment_status: "pending"`, `status: "pending"`
- AND the response includes bank details (account info)
- AND the cart is cleared

### Scenario: Admin confirms transfer payment

- GIVEN order "ord-123" has `payment_method: "transfer"` and `payment_status: "pending"`
- WHEN `PATCH /api/admin/orders/ord-123/confirm-transfer` by admin
- THEN status 200
- AND order has `payment_status: "paid"` and `status: "confirmed"`

### Scenario: Admin cannot confirm already-paid transfer

- GIVEN order "ord-123" already has `payment_status: "paid"`
- WHEN `PATCH /api/admin/orders/ord-123/confirm-transfer`
- THEN status 400 with error indicating payment already confirmed

### Scenario: Non-admin cannot confirm transfer

- GIVEN a student token (not admin)
- WHEN `PATCH /api/admin/orders/ord-123/confirm-transfer`
- THEN status 403

### Scenario: Frontend shows transfer UI

- GIVEN the checkout page in Cart.jsx
- WHEN student clicks "Transferencia Bancaria"
- THEN the UI transitions to show bank account details (CBU, alias, bank name, holder)
- AND a "Ya realicé la transferencia" confirmation button

## Validation Rules

| Rule | Behavior |
|------|----------|
| Transfer confirmation | Same admin guard as cash confirmation (`adminMiddleware`) |
| Duplicate confirmation | Prevent double-confirm with `payment_status` check |
| Payment method enum | Use existing `PaymentMethod` enum — add `transfer` if not present |
| Bank details source | Reuse existing `getBankDetails` data (no new backend endpoint needed) |
