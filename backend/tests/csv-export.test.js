/**
 * CSV Export — integration tests for export endpoints.
 *
 * Covers:
 *  - GET /api/admin/export/progress — returns CSV with headers
 *  - GET /api/admin/export/orders — returns CSV with headers
 *  - Unauthenticated requests return 401
 *  - Non-admin returns 403
 */
import { describe, it, expect, afterAll, beforeAll } from 'vitest';
import request from 'supertest';
import app from '../src/app.js';
import {
  cleanupTestData, getToken,
  createTestAdmin, createTestUser,
} from './helpers.js';

const agent = request(app);
let adminToken, userToken;

beforeAll(async () => {
  await cleanupTestData();
  const admin = await createTestAdmin();
  adminToken = await getToken(agent, admin.student.email, admin.password);
  const user = await createTestUser();
  userToken = await getToken(agent, user.student.email, user.password);
});

afterAll(async () => {
  await cleanupTestData();
});

describe('GET /api/admin/export/progress', () => {
  it('returns CSV with correct headers and Content-Type', async () => {
    const res = await agent
      .get('/api/admin/export/progress')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toBe('text/csv; charset=utf-8');
    expect(res.headers['content-disposition']).toContain('attachment');
    expect(res.headers['content-disposition']).toContain('progress');

    // Check for UTF-8 BOM (\uFEFF) as first character
    expect(res.text.charCodeAt(0)).toBe(0xFEFF);

    // Check headers
    const lines = res.text.split('\n');
    const headerLine = lines[0].replace('\uFEFF', '');
    expect(headerLine).toContain('school');
    expect(headerLine).toContain('course');
    expect(headerLine).toContain('booklet');
    expect(headerLine).toContain('total_students');
    expect(headerLine).toContain('completed');
    expect(headerLine).toContain('pending');
    expect(headerLine).toContain('percentage');
    expect(headerLine).toContain('printed');
    expect(headerLine).toContain('ordered');
    expect(headerLine).toContain('faltantes');
  });

  it('returns 401 when unauthenticated', async () => {
    const res = await agent.get('/api/admin/export/progress');
    expect(res.status).toBe(401);
  });

  it('returns 403 for non-admin user', async () => {
    const res = await agent
      .get('/api/admin/export/progress')
      .set('Authorization', `Bearer ${userToken}`);
    expect(res.status).toBe(403);
  });
});

describe('GET /api/admin/export/orders', () => {
  it('returns CSV with correct headers and Content-Type', async () => {
    const res = await agent
      .get('/api/admin/export/orders')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toBe('text/csv; charset=utf-8');
    expect(res.headers['content-disposition']).toContain('attachment');
    expect(res.headers['content-disposition']).toContain('orders');

    // Check for UTF-8 BOM
    expect(res.text.charCodeAt(0)).toBe(0xFEFF);

    const lines = res.text.split('\n');
    const headerLine = lines[0].replace('\uFEFF', '');
    expect(headerLine).toContain('order_id');
    expect(headerLine).toContain('student');
    expect(headerLine).toContain('course');
    expect(headerLine).toContain('school');
    expect(headerLine).toContain('total');
    expect(headerLine).toContain('status');
    expect(headerLine).toContain('payment_method');
    expect(headerLine).toContain('payment_status');
    expect(headerLine).toContain('created_at');
  });

  it('returns 401 when unauthenticated', async () => {
    const res = await agent.get('/api/admin/export/orders');
    expect(res.status).toBe(401);
  });

  it('returns 403 for non-admin user', async () => {
    const res = await agent
      .get('/api/admin/export/orders')
      .set('Authorization', `Bearer ${userToken}`);
    expect(res.status).toBe(403);
  });
});
