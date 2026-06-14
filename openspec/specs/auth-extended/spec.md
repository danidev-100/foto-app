# Full Spec: auth-extended

> **Change**: mega-features — forgot/reset password + token refresh
> **Stack**: Node.js + Express + Prisma + PostgreSQL
> **Status**: Draft

## Purpose

Extend the auth system with password recovery (forgot/reset) and JWT token refresh flows. These are new capabilities built on the existing login/register auth.

## Requirements

| ID | Description | Priority |
|----|------------|----------|
| AUTH-EXT-01 | `POST /api/auth/forgot-password` SHALL accept `{email}`, generate a reset token, store it in `ResetToken` model, and send an email with reset link. SHALL always return 200 (even if email not found) to prevent email enumeration. | P0 |
| AUTH-EXT-02 | `POST /api/auth/reset-password` SHALL accept `{token, newPassword}`, validate the token (exists, not expired, not used), hash the new password, update student, and mark token as used. | P0 |
| AUTH-EXT-03 | Reset tokens SHALL expire after 1 hour. Expired tokens SHALL return 400 with `TOKEN_EXPIRED`. | P0 |
| AUTH-EXT-04 | `POST /api/auth/refresh` SHALL accept `{refreshToken}`, validate it, issue a new JWT access token, and optionally rotate the refresh token. | P0 |
| AUTH-EXT-05 | Frontend axios interceptor SHALL catch 401 responses, attempt token refresh once, retry the original request, and only redirect to login if refresh fails. | P0 |
| AUTH-EXT-06 | The `Login` student response SHALL include a `refreshToken` (HTTP-only cookie or body field). A `RefreshToken` model SHALL persist refresh tokens per student. | P0 |

### Scenario: Forgot password sends email

- GIVEN a student exists with email "student@example.com"
- WHEN `POST /api/auth/forgot-password` with `{"email": "student@example.com"}`
- THEN status 200 with `{"message": "Si el email existe, recibirás un enlace de recuperación"}`
- AND a `ResetToken` is created with `expiresAt = now + 1h`
- AND an email is sent to that address with a reset link containing the token

### Scenario: Forgot password hides non-existent email

- WHEN `POST /api/auth/forgot-password` with `{"email": "nonexistent@test.com"}`
- THEN status 200 with the same generic message
- AND no email is sent

### Scenario: Reset password with valid token

- GIVEN a valid reset token "abc123" exists for student "s-1" and is not expired
- WHEN `POST /api/auth/reset-password` with `{"token": "abc123", "newPassword": "NewPass123!"}`
- THEN status 200 with `{"message": "Contraseña actualizada exitosamente"}`
- AND the student's password hash is updated
- AND the token's `usedAt` is set

### Scenario: Reset with expired token

- GIVEN a reset token created 2 hours ago (expired)
- WHEN `POST /api/auth/reset-password` with that token
- THEN status 400 with error code `TOKEN_EXPIRED`

### Scenario: Reset with already-used token

- GIVEN a reset token that has been used (`usedAt` is set)
- WHEN `POST /api/auth/reset-password` with that token
- THEN status 400 with error code `TOKEN_INVALID`

### Scenario: Token refresh succeeds

- GIVEN student "s-1" has a valid refresh token
- WHEN `POST /api/auth/refresh` with `{"refreshToken": "valid-refresh-token"}`
- THEN status 200 with a new JWT `accessToken`
- AND optionally a new `refreshToken`

### Scenario: Token refresh with invalid token

- WHEN `POST /api/auth/refresh` with an invalid or revoked refresh token
- THEN status 401

### Scenario: Frontend 401 interceptor refreshes silently

- GIVEN the student's JWT is expired but refresh token is valid
- WHEN a request returns 401
- THEN the interceptor calls `POST /api/auth/refresh`
- AND retries the original request with the new token
- AND the student is NOT redirected to login

### Scenario: Frontend interceptor redirects on refresh failure

- GIVEN both JWT and refresh token are expired/invalid
- WHEN a request returns 401
- THEN the interceptor attempts refresh, which fails
- AND the student is redirected to login

## Validation Rules

| Rule | Behavior |
|------|----------|
| Email enumeration protection | Forgot password always returns 200, never reveals if email exists |
| Token expiry | 1 hour from creation; checked at reset time |
| One-time use | Token `usedAt` prevents replay |
| Refresh token rotation | Optionally issue new refresh token on each refresh (configurable) |
| Concurrent 401 handling | Queue concurrent 401s; single refresh at a time (prevent race) |

## Error Codes

| Code | HTTP | When |
|------|------|------|
| `TOKEN_EXPIRED` | 400 | Reset token is past `expiresAt` |
| `TOKEN_INVALID` | 400 | Token not found or already used |
| `AUTH_004` | 401 | Invalid/expired refresh token |
