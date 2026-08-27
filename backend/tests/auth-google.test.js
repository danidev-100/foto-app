/**
 * AuthService googleLogin unit tests.
 *
 * Tests:
 *   - googleLogin creates a new student and returns tokens
 *   - googleLogin links an existing student (email/password) by Google id
 *   - googleLogin rejects an invalid Google ID token
 *   - googleLogin rejects a Google account with unverified email
 *   - googleLogin requires idToken
 *   - googleLogin fails when GOOGLE_CLIENT_ID is not configured
 *   - googleLogin rejects a deactivated account
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Shared state so the mocked OAuth2Client instance method and the test body
// always reference the SAME implementation, regardless of mock identity.
const { googleState } = vi.hoisted(() => ({ googleState: { verifyIdToken: null } }));

// Mock google-auth-library
vi.mock('google-auth-library', () => ({
  OAuth2Client: class {
    constructor() {
      this.verifyIdToken = (...args) => googleState.verifyIdToken(...args);
    }
  },
}));

// Mock bcrypt for speed
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

// Mock config so googleClientId is deterministic
vi.mock('../src/config.js', () => ({
  config: {
    googleClientId: 'test-client-id',
    jwtSecret: 'test-secret-key',
    jwtExpiration: '15m',
    jwtRefreshExpiration: '7d',
    frontendUrl: 'http://localhost:3000',
  },
}));

// Mock prisma
vi.mock('../src/lib/prisma.js', () => ({
  prisma: {
    student: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
    refreshToken: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
    $transaction: vi.fn(),
  },
}));

const { prisma } = await import('../src/lib/prisma.js');
const { config } = await import('../src/config.js');
const { AuthService } = await import('../src/services/auth.service.js');

function googlePayload(overrides = {}) {
  return {
    email: 'student@test.com',
    email_verified: true,
    name: 'Test Student',
    sub: 'google-sub-123',
    ...overrides,
  };
}

function studentRow(overrides = {}) {
  return {
    id: 'student-1',
    name: 'Test Student',
    email: 'student@test.com',
    passwordHash: '$2b$12$hashedpasswordmock',
    googleId: null,
    isAdmin: false,
    isActive: true,
    ...overrides,
  };
}

function mockValidTicket(payload = googlePayload()) {
  googleState.verifyIdToken = vi.fn(async () => ({ getPayload: () => payload }));
  return googleState.verifyIdToken;
}

beforeEach(() => {
  vi.clearAllMocks();
  config.googleClientId = 'test-client-id';
});

/* ─── googleLogin ─────────────────────────────────────── */

describe('googleLogin', () => {
  it('creates a new student and returns tokens', async () => {
    const verifyIdToken = mockValidTicket();
    prisma.student.findUnique.mockResolvedValue(null);
    prisma.student.create.mockResolvedValue(studentRow({ googleId: 'google-sub-123' }));
    prisma.refreshToken.create.mockResolvedValue({ id: 'rft-1' });

    const svc = new AuthService();
    const result = await svc.googleLogin({ idToken: 'fake-id-token' });

    expect(verifyIdToken).toHaveBeenCalledWith({
      idToken: 'fake-id-token',
      audience: 'test-client-id',
    });
    expect(prisma.student.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          email: 'student@test.com',
          googleId: 'google-sub-123',
          isAdmin: false,
          isActive: true,
        }),
      }),
    );
    expect(result).toHaveProperty('token', 'mock-jwt-token');
    expect(result).toHaveProperty('refreshToken');
    expect(result.student).not.toHaveProperty('passwordHash');
    expect(prisma.refreshToken.create).toHaveBeenCalled();
  });

  it('links an existing student (email/password) and returns tokens', async () => {
    mockValidTicket();
    prisma.student.findUnique.mockResolvedValue(studentRow());
    prisma.student.update.mockResolvedValue(studentRow({ googleId: 'google-sub-123' }));
    prisma.refreshToken.create.mockResolvedValue({ id: 'rft-1' });

    const svc = new AuthService();
    const result = await svc.googleLogin({ idToken: 'fake-id-token' });

    expect(prisma.student.create).not.toHaveBeenCalled();
    expect(prisma.student.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'student-1' },
        data: { googleId: 'google-sub-123' },
      }),
    );
    expect(result.student.id).toBe('student-1');
  });

  it('does not overwrite googleId when the account is already linked', async () => {
    mockValidTicket();
    prisma.student.findUnique.mockResolvedValue(
      studentRow({ googleId: 'google-sub-123' }),
    );
    prisma.refreshToken.create.mockResolvedValue({ id: 'rft-1' });

    const svc = new AuthService();
    const result = await svc.googleLogin({ idToken: 'fake-id-token' });

    expect(prisma.student.update).not.toHaveBeenCalled();
    expect(result.student.googleId).toBe('google-sub-123');
  });

  it('rejects an invalid Google ID token', async () => {
    googleState.verifyIdToken = vi.fn(async () => {
      throw new Error('bad signature');
    });

    const svc = new AuthService();
    await expect(
      svc.googleLogin({ idToken: 'bad-token' }),
    ).rejects.toMatchObject({ code: 'GOOGLE_TOKEN_INVALID', status: 401 });
  });

  it('rejects a Google account with unverified email', async () => {
    mockValidTicket(googlePayload({ email_verified: false }));

    const svc = new AuthService();
    await expect(
      svc.googleLogin({ idToken: 'token-no-email-verified' }),
    ).rejects.toMatchObject({ code: 'GOOGLE_TOKEN_INVALID', status: 401 });
  });

  it('rejects when idToken is missing', async () => {
    const svc = new AuthService();
    await expect(
      svc.googleLogin({ idToken: '' }),
    ).rejects.toMatchObject({ code: 'AUTH_004', status: 400 });
  });

  it('fails when GOOGLE_CLIENT_ID is not configured', async () => {
    config.googleClientId = '';

    const svc = new AuthService();
    await expect(
      svc.googleLogin({ idToken: 'fake-id-token' }),
    ).rejects.toMatchObject({ code: 'GOOGLE_NOT_CONFIGURED', status: 503 });
  });

  it('rejects a deactivated account', async () => {
    mockValidTicket();
    prisma.student.findUnique.mockResolvedValue(
      studentRow({ googleId: 'google-sub-123', isActive: false }),
    );

    const svc = new AuthService();
    await expect(
      svc.googleLogin({ idToken: 'fake-id-token' }),
    ).rejects.toMatchObject({ code: 'AUTH_005', status: 401 });
  });
});