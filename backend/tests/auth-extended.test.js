/**
 * AuthService extended unit tests — forgot/reset password + refresh token.
 *
 * Tests:
 *   - forgotPassword sends email for valid email
 *   - forgotPassword returns success even for unknown email (security)
 *   - resetPassword with valid token updates password
 *   - resetPassword with expired token returns error
 *   - resetPassword with used token returns error
 *   - refresh token returns new tokens
 *   - refresh with invalid token returns error
 *   - refresh with revoked token returns error (rotation breach)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock bcrypt for speed — auth.service.js uses `import bcrypt from 'bcrypt'` (default import)
vi.mock('bcrypt', () => ({
  default: {
    hash: vi.fn().mockResolvedValue('$2b$12$hashedpasswordmock'),
    compare: vi.fn().mockResolvedValue(true),
  },
  hash: vi.fn().mockResolvedValue('$2b$12$hashedpasswordmock'),
  compare: vi.fn().mockResolvedValue(true),
}));

// Mock jsonwebtoken
vi.mock('jsonwebtoken', () => ({
  default: { sign: vi.fn().mockReturnValue('mock-jwt-token') },
  sign: vi.fn().mockReturnValue('mock-jwt-token'),
}));

// Mock email service to prevent SMTP init
vi.mock('../src/services/email.service.js', () => ({
  EmailService: vi.fn(() => ({
    sendResetEmail: vi.fn().mockResolvedValue({ messageId: 'mock' }),
    sendEmail: vi.fn().mockResolvedValue({ messageId: 'mock' }),
  })),
}));

// Mock prisma
vi.mock('../src/lib/prisma.js', () => ({
  prisma: {
    student: { findUnique: vi.fn(), update: vi.fn() },
    resetToken: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
    refreshToken: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
    $transaction: vi.fn(),
  },
}));

const { prisma } = await import('../src/lib/prisma.js');
const { AuthService } = await import('../src/services/auth.service.js');

function makeService() {
  return new AuthService();
}

beforeEach(() => {
  vi.clearAllMocks();
  // Ensure JWT_SECRET is set
  process.env.JWT_SECRET = 'test-secret-key';
});

/* ─── forgotPassword ───────────────────────────────────── */

describe('forgotPassword', () => {
  it('returns success message for valid email', async () => {
    prisma.student.findUnique.mockResolvedValue({
      id: 'student-1', email: 'student@test.com', name: 'Test',
    });
    prisma.resetToken.create.mockResolvedValue({
      id: 'rt-1', studentId: 'student-1', token: 'hashed',
    });

    const svc = makeService();
    const result = await svc.forgotPassword('student@test.com');

    expect(result.message).toContain('email existe');
    expect(prisma.resetToken.create).toHaveBeenCalled();
  });

  it('returns success message for unknown email (security — no enumeration)', async () => {
    prisma.student.findUnique.mockResolvedValue(null);

    const svc = makeService();
    const result = await svc.forgotPassword('unknown@test.com');

    expect(result.message).toContain('email existe');
    // Should NOT create a reset token
    expect(prisma.resetToken.create).not.toHaveBeenCalled();
  });

  it('requires email parameter', async () => {
    const svc = makeService();
    await expect(
      svc.forgotPassword(''),
    ).rejects.toMatchObject({ code: 'AUTH_004', status: 400 });
  });
});

/* ─── resetPassword ────────────────────────────────────── */

describe('resetPassword', () => {
  it('updates password with valid token', async () => {
    const token = 'valid-token-123';

    prisma.resetToken.findUnique.mockResolvedValue({
      id: 'rt-1', studentId: 'student-1',
      token: 'hashed-token',
      usedAt: null,
      expiresAt: new Date(Date.now() + 3600000), // 1 hour from now
    });
    prisma.$transaction.mockImplementation(async (ops) => {
      // Execute all operations in sequence
      for (const op of ops) await op;
    });
    prisma.student.update.mockResolvedValue({ id: 'student-1' });
    prisma.resetToken.update.mockResolvedValue({ id: 'rt-1', usedAt: new Date() });

    const svc = makeService();
    const result = await svc.resetPassword({ token, newPassword: 'NewPass123!' });

    expect(result.message).toContain('actualizada');
    expect(prisma.$transaction).toHaveBeenCalled();
  });

  it('returns error for invalid (nonexistent) token', async () => {
    prisma.resetToken.findUnique.mockResolvedValue(null);

    const svc = makeService();
    await expect(
      svc.resetPassword({ token: 'fake-token', newPassword: 'NewPass123!' }),
    ).rejects.toMatchObject({ code: 'TOKEN_INVALID', status: 400 });
  });

  it('returns error for expired token', async () => {
    prisma.resetToken.findUnique.mockResolvedValue({
      id: 'rt-2', studentId: 'student-1',
      token: 'expired-hash',
      usedAt: null,
      expiresAt: new Date(Date.now() - 3600000), // 1 hour ago
    });

    const svc = makeService();
    await expect(
      svc.resetPassword({ token: 'expired-token', newPassword: 'NewPass123!' }),
    ).rejects.toMatchObject({ code: 'TOKEN_EXPIRED', status: 400 });
  });

  it('returns error for already used token', async () => {
    prisma.resetToken.findUnique.mockResolvedValue({
      id: 'rt-3', studentId: 'student-1',
      token: 'used-hash',
      usedAt: new Date(),
      expiresAt: new Date(Date.now() + 3600000),
    });

    const svc = makeService();
    await expect(
      svc.resetPassword({ token: 'used-token', newPassword: 'NewPass123!' }),
    ).rejects.toMatchObject({ code: 'TOKEN_INVALID', status: 400 });
  });

  it('requires both token and newPassword', async () => {
    const svc = makeService();
    await expect(
      svc.resetPassword({ token: '', newPassword: '' }),
    ).rejects.toMatchObject({ code: 'AUTH_004', status: 400 });
  });
});

/* ─── refreshAccessToken ───────────────────────────────── */

describe('refreshAccessToken', () => {
  it('returns new tokens for valid refresh token', async () => {
    prisma.refreshToken.findUnique.mockResolvedValue({
      id: 'rft-1', studentId: 'student-1',
      tokenHash: 'valid-hash',
      revokedAt: null,
      expiresAt: new Date(Date.now() + 86400000), // 1 day from now
      student: { id: 'student-1', email: 'test@test.com', isAdmin: false, courseId: null },
    });
    prisma.refreshToken.update.mockResolvedValue({ id: 'rft-1', revokedAt: new Date() });
    prisma.refreshToken.create.mockResolvedValue({
      id: 'rft-2', studentId: 'student-1', tokenHash: 'new-hash',
    });

    const svc = makeService();
    const result = await svc.refreshAccessToken({ refreshToken: 'valid-raw-token' });

    expect(result).toHaveProperty('token');
    expect(result).toHaveProperty('refreshToken');
    expect(prisma.refreshToken.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ revokedAt: expect.any(Date) }) }),
    );
    expect(prisma.refreshToken.create).toHaveBeenCalled();
  });

  it('returns error for invalid refresh token', async () => {
    prisma.refreshToken.findUnique.mockResolvedValue(null);

    const svc = makeService();
    await expect(
      svc.refreshAccessToken({ refreshToken: 'invalid-token' }),
    ).rejects.toMatchObject({ code: 'AUTH_004', status: 401 });
  });

  it('returns error for expired refresh token', async () => {
    prisma.refreshToken.findUnique.mockResolvedValue({
      id: 'rft-2', studentId: 'student-1',
      tokenHash: 'expired-hash',
      revokedAt: null,
      expiresAt: new Date(Date.now() - 86400000), // 1 day ago
      student: { id: 'student-1' },
    });

    const svc = makeService();
    await expect(
      svc.refreshAccessToken({ refreshToken: 'expired-token' }),
    ).rejects.toMatchObject({ code: 'AUTH_004', status: 401 });
  });

  it('revokes ALL tokens on rotation breach (revoked token reuse)', async () => {
    prisma.refreshToken.findUnique.mockResolvedValue({
      id: 'rft-3', studentId: 'student-1',
      tokenHash: 'revoked-hash',
      revokedAt: new Date(), // Already revoked
      expiresAt: new Date(Date.now() + 86400000),
      student: { id: 'student-1' },
    });
    prisma.refreshToken.updateMany.mockResolvedValue({ count: 2 });

    const svc = makeService();
    await expect(
      svc.refreshAccessToken({ refreshToken: 'revoked-token' }),
    ).rejects.toMatchObject({ code: 'AUTH_004', status: 401 });

    // Should revoke ALL non-revoked tokens for this student
    expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
      where: { studentId: 'student-1', revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    });
  });

  it('requires refreshToken parameter', async () => {
    const svc = makeService();
    await expect(
      svc.refreshAccessToken({ refreshToken: '' }),
    ).rejects.toMatchObject({ code: 'AUTH_004', status: 400 });
  });
});
