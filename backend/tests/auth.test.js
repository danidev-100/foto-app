/**
 * Auth & Registration — integration tests against the real DB.
 *
 * Covers:
 *  - POST /api/auth/register (success, duplicate, validation)
 *  - POST /api/auth/login (success, wrong password)
 *  - Protected routes reject unauthenticated requests
 *  - Admin routes reject non-admin users
 */
import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { describe, it, expect, afterAll, beforeAll } from 'vitest';
import request from 'supertest';
import app from '../src/app.js';
import { cleanupTestData, testEmail, getToken, createTestUser, createTestAdmin } from './helpers.js';
import { prisma } from '../src/lib/prisma.js';

const agent = request(app);

beforeAll(async () => {
  // Ensure we start clean
  await cleanupTestData();
});

afterAll(async () => {
  await cleanupTestData();
});

/* ─── REGISTER ─────────────────────────────────────────── */

describe('POST /api/auth/register', () => {
  const email = testEmail('register');

  it('registers a new user successfully', async () => {
    const res = await agent
      .post('/api/auth/register')
      .send({ name: 'Test Student', email, password: 'Password123!' });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('token');
    expect(res.body.data.student).toHaveProperty('id');
    expect(res.body.data.student.email).toBe(email);
    expect(res.body.data.student.isAdmin).toBe(false);
  });

  it('rejects duplicate email', async () => {
    const res = await agent
      .post('/api/auth/register')
      .send({ name: 'Dupe', email, password: 'Password123!' });

    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('AUTH_003');
  });

  it('rejects missing required fields', async () => {
    const res = await agent
      .post('/api/auth/register')
      .send({ name: 'No Email' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('AUTH_004');
  });
});

/* ─── LOGIN ────────────────────────────────────────────── */

describe('POST /api/auth/login', () => {
  const email = testEmail('login');
  const password = 'MyPassword42!';

  beforeAll(async () => {
    await createTestUser({ email, password });
  });

  it('logs in with valid credentials', async () => {
    const res = await agent
      .post('/api/auth/login')
      .send({ email, password });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('token');
    expect(res.body.data.student.email).toBe(email);
  });

  it('rejects wrong password', async () => {
    const res = await agent
      .post('/api/auth/login')
      .send({ email, password: 'WrongPassword!' });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('AUTH_005');
  });

  it('rejects non-existent email', async () => {
    const res = await agent
      .post('/api/auth/login')
      .send({ email: 'doesnotexist@test.com', password: 'Anything1!' });

    expect(res.status).toBe(401);
  });
});

/* ─── PROTECTED ROUTES ─────────────────────────────────── */

describe('Protected routes', () => {
  it('rejects requests without token', async () => {
    const res = await agent.get('/api/catalog/booklets');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('AUTH_001');
  });

  it('accepts requests with valid token', async () => {
    const { student, password } = await createTestUser();
    const token = await getToken(agent, student.email, password);

    const res = await agent
      .get('/api/catalog/booklets')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});

/* ─── ADMIN ROUTE PROTECTION ───────────────────────────── */

describe('Admin route protection', () => {
  let adminToken, userToken;

  beforeAll(async () => {
    const admin = await createTestAdmin();
    const user = await createTestUser();
    adminToken = await getToken(agent, admin.student.email, admin.password);
    userToken = await getToken(agent, user.student.email, user.password);
  });

  it('allows admin to access admin routes', async () => {
    const res = await agent
      .get('/api/admin/schools')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
  });

  it('rejects non-admin users from admin routes', async () => {
    const res = await agent
      .get('/api/admin/schools')
      .set('Authorization', `Bearer ${userToken}`);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('AUTH_002');
  });
});

/* ─── FORGOT / RESET PASSWORD ──────────────────────────── */

describe('POST /api/auth/forgot-password', () => {
  const email = testEmail('forgot');

  beforeAll(async () => {
    await createTestUser({ email, password: 'TestPass123!' });
  });

  it('returns 200 with generic message for existing email', async () => {
    // Email sending might fail in test (no SMTP), but the endpoint
    // should still return 200 — email failure is fire-and-forget.
    const res = await agent
      .post('/api/auth/forgot-password')
      .send({ email });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('message');
    expect(res.body.data.message).toContain('email existe');
  });

  it('returns 200 with generic message for non-existing email (no enumeration)', async () => {
    const res = await agent
      .post('/api/auth/forgot-password')
      .send({ email: 'nobody@nonexistent-test.com' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.message).toContain('email existe');
  });

  it('rejects missing email field', async () => {
    const res = await agent
      .post('/api/auth/forgot-password')
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('AUTH_004');
  });
});

describe('POST /api/auth/reset-password', () => {
  const email = testEmail('reset-e2e');
  const RAW_TOKEN = 'test-raw-token-for-e2e-reset-test-abc';
  let studentId;

  beforeAll(async () => {
    const { student } = await createTestUser({ email, password: 'OldPass123!' });
    studentId = student.id;
  });

  it('resets password with a valid token', async () => {
    // Insert a reset token with pre-hashed token
    // The auth service hashes the raw token with SHA-256 before looking it up
    const tokenHash = crypto.createHash('sha256').update(RAW_TOKEN).digest('hex');

    await prisma.resetToken.create({
      data: {
        id: uuidv4(),
        studentId,
        token: tokenHash,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      },
    });

    const newPassword = 'NewPass456!';

    const res = await agent
      .post('/api/auth/reset-password')
      .send({ token: RAW_TOKEN, newPassword });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.message).toContain('actualizada');

    // Verify we can login with the new password
    const loginRes = await agent
      .post('/api/auth/login')
      .send({ email, password: newPassword });
    expect(loginRes.status).toBe(200);

    // Old password should fail
    const oldLoginRes = await agent
      .post('/api/auth/login')
      .send({ email, password: 'OldPass123!' });
    expect(oldLoginRes.status).toBe(401);
  });

  it('rejects an already-used token', async () => {
    const tokenHash = crypto.createHash('sha256').update(RAW_TOKEN).digest('hex');

    // Ensure a used token exists
    const existing = await prisma.resetToken.findUnique({ where: { token: tokenHash } });
    if (!existing) {
      await prisma.resetToken.create({
        data: {
          id: uuidv4(),
          studentId,
          token: tokenHash,
          expiresAt: new Date(Date.now() + 60 * 60 * 1000),
          usedAt: new Date(),
        },
      });
    }

    const res = await agent
      .post('/api/auth/reset-password')
      .send({ token: RAW_TOKEN, newPassword: 'AnotherPass789!' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('TOKEN_INVALID');
  });

  it('rejects a non-existent token', async () => {
    const res = await agent
      .post('/api/auth/reset-password')
      .send({ token: 'definitely-not-a-real-token', newPassword: 'NewPass123!' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('TOKEN_INVALID');
  });

  it('rejects missing fields', async () => {
    const res = await agent
      .post('/api/auth/reset-password')
      .send({ token: 'something' }); // no newPassword

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('AUTH_004');
  });
});

/* ─── TOKEN REFRESH ─────────────────────────────────────── */

describe('POST /api/auth/refresh', () => {
  const email = testEmail('refresh');
  const password = 'RefreshTest1!';
  let refreshToken;

  beforeAll(async () => {
    await createTestUser({ email, password });
    // Login to get a refresh token
    const res = await agent
      .post('/api/auth/login')
      .send({ email, password });
    refreshToken = res.body.data?.refreshToken;
  });

  it('login returns a refreshToken', async () => {
    expect(refreshToken).toBeDefined();
    expect(typeof refreshToken).toBe('string');
    expect(refreshToken.length).toBeGreaterThan(16);
  });

  it('register returns a refreshToken', async () => {
    const regEmail = testEmail('refresh-reg');
    const res = await agent
      .post('/api/auth/register')
      .send({ name: 'Refresh Reg', email: regEmail, password: 'RegPass123!' });
    expect(res.status).toBe(201);
    expect(res.body.data).toHaveProperty('refreshToken');
    expect(typeof res.body.data.refreshToken).toBe('string');
  });

  it('refresh returns a new access token with valid refresh token', async () => {
    const res = await agent
      .post('/api/auth/refresh')
      .send({ refreshToken });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('token');
    expect(res.body.data).toHaveProperty('refreshToken');
    expect(typeof res.body.data.token).toBe('string');
    // The new access token should be decodable
    const jwt = await import('jsonwebtoken');
    const decoded = jwt.default.verify(res.body.data.token, process.env.JWT_SECRET || 'test-secret-key-for-tests');
    expect(decoded).toHaveProperty('student_id');
    expect(decoded).toHaveProperty('email', email);
  });

  it('returns 401 with an invalid refresh token', async () => {
    const res = await agent
      .post('/api/auth/refresh')
      .send({ refreshToken: 'this-is-definitely-invalid' });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('AUTH_004');
  });

  it('returns 401 with a reused (revoked) refresh token', async () => {
    // Get a fresh, unused token for this test
    const freshEmail = testEmail('refresh-reuse');
    await createTestUser({ email: freshEmail, password: 'ReuseTest1!' });
    const reuseLogin = await agent
      .post('/api/auth/login')
      .send({ email: freshEmail, password: 'ReuseTest1!' });
    const freshToken = reuseLogin.body.data?.refreshToken;
    expect(freshToken).toBeDefined();

    // First refresh — consumes the token and issues a new one
    const firstRefresh = await agent
      .post('/api/auth/refresh')
      .send({ refreshToken: freshToken });
    expect(firstRefresh.status).toBe(200);

    // Try to reuse the old (now revoked) token
    const secondRefresh = await agent
      .post('/api/auth/refresh')
      .send({ refreshToken: freshToken });

    expect(secondRefresh.status).toBe(401);
    expect(secondRefresh.body.error.code).toBe('AUTH_004');
  });
});
