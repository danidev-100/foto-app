/**
 * Auth & Registration — integration tests against the real DB.
 *
 * Covers:
 *  - POST /api/auth/register (success, duplicate, validation)
 *  - POST /api/auth/login (success, wrong password)
 *  - Protected routes reject unauthenticated requests
 *  - Admin routes reject non-admin users
 */
import { describe, it, expect, afterAll, beforeAll } from 'vitest';
import request from 'supertest';
import app from '../src/app.js';
import { cleanupTestData, testEmail, getToken, createTestUser, createTestAdmin } from './helpers.js';

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
