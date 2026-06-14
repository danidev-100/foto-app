# Full Spec: email-notifications

> **Change**: mega-features — transactional email notifications
> **Stack**: Node.js + Express + Nodemailer + Gmail SMTP
> **Status**: Draft

## Purpose

Send transactional email notifications to students: order confirmation, order status changes, and payment confirmations. Reuses the Nodemailer email infrastructure built for forgot-password.

## Requirements

| ID | Description | Priority |
|----|------------|----------|
| EMAIL-01 | An `EmailService` SHALL expose `send(to, subject, html)` using Nodemailer + Gmail SMTP. All parameters (host, port, user, pass) SHALL come from env config. | P0 |
| EMAIL-02 | An email SHALL be sent to the student when an order is placed with `payment_method: "cash"` or `"transfer"`, containing order summary (items, total, payment instructions). | P0 |
| EMAIL-03 | An email SHALL be sent to the student when an order status changes (pending → confirmed, in_progress, ready, delivered), containing the new status. | P0 |
| EMAIL-04 | An email SHALL be sent to the student when payment is confirmed (cash or transfer admin confirmation), containing payment confirmation details. | P0 |
| EMAIL-05 | For Mercado Pago payments, the confirmation email SHALL be sent when the webhook confirms payment (not at order creation). | P0 |
| EMAIL-06 | Email templates SHALL be simple HTML (table-based layout, inline styles) with the app branding (logo, school name). | P0 |
| EMAIL-07 | Email sending SHALL be fire-and-forget — failures SHALL be logged but MUST NOT block the primary operation. | P1 |

### Scenario: Order confirmation email (cash/transfer)

- GIVEN a student places an order with `payment_method: "cash"`
- WHEN the order is created successfully
- THEN an email is sent to the student's email
- AND the email contains: order ID, list of items with quantities, total price, payment method, school name
- AND the order creation response is returned immediately (not blocked by email)

### Scenario: Order status change email

- GIVEN order "ord-123" changes from "confirmed" to "in_progress"
- WHEN admin updates the status
- THEN an email is sent to the student
- AND the email subject says "Tu pedido está en progreso"
- AND the email body contains the new status

### Scenario: Payment confirmation email

- GIVEN admin confirms a transfer payment for order "ord-456"
- WHEN `PATCH /api/admin/orders/ord-456/confirm-transfer` succeeds
- THEN an email is sent to the student
- AND the email confirms the payment was received

### Scenario: MP webhook triggers confirmation email

- GIVEN order "ord-789" is paid via Mercado Pago
- WHEN the MP webhook confirms payment
- THEN a confirmation email is sent to the student
- AND the email includes payment method "Mercado Pago"

### Scenario: Email failure does not block operation

- GIVEN SMTP is unreachable
- WHEN an order is placed
- THEN the order is created successfully (status 201)
- AND the error is logged
- AND the student is not notified of the failure

## Email Events

| Event | Trigger | Template |
|-------|---------|----------|
| Order placed | Order created (cash/transfer) | Order summary + payment instructions |
| Payment confirmed | Admin confirms cash/transfer | Payment receipt notice |
| Status changed | Admin updates order status | New status + current status |
| MP paid | Webhook confirms MP payment | Payment confirmed + order summary |
| Forgot password | Forgot password request | Reset link (built in auth-extended) |

## Config

| Var | Description |
|-----|-------------|
| `SMTP_HOST` | Gmail SMTP host (smtp.gmail.com) |
| `SMTP_PORT` | 587 (TLS) |
| `SMTP_USER` | Gmail account email |
| `SMTP_PASS` | Gmail app password (not regular password) |
| `EMAIL_FROM` | Sender name/address |
