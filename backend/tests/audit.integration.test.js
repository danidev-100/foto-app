/**
 * Audit Log — integration tests for audit API endpoints.
 *
 * Covers:
 *  - Admin booklet CRUD auto-logs audit entries
 *  - GET  /api/admin/audit-logs          — paginated logs
 *  - GET  /api/admin/audit-logs?entity=  — filtered
 *  - GET  /api/admin/audit-logs/stats    — aggregated stats
 *  - Non-admin user                      — 403
 *  - Unauthenticated                     — 401
 */
import { describe, it, expect, afterAll, beforeAll } from 'vitest';
import request from 'supertest';
import app from '../src/app.js';
import {
  cleanupTestData, getToken, getTestSchools,
  getSchoolCourses, getActiveDivisions,
  createTestAdmin, createTestUser,
} from './helpers.js';

const agent = request(app);
let adminToken, userToken;
let school, course, division;

beforeAll(async () => {
  await cleanupTestData();
  const admin = await createTestAdmin();
  adminToken = await getToken(agent, admin.student.email, admin.password);
  const user = await createTestUser();
  userToken = await getToken(agent, user.student.email, user.password);

  const schools = await getTestSchools();
  school = schools[0];
  const schoolCourses = await getSchoolCourses(school.id);
  course = schoolCourses[0];
  const allDivs = await getActiveDivisions();
  division = allDivs.find((d) => d.courseId === course?.id);
});

afterAll(async () => {
  await cleanupTestData();
});

describe('Audit log API', () => {
  let bookletId;

  it('creates audit log on booklet creation', async () => {
    if (!course || !division) return;
    const res = await agent
      .post('/api/admin/booklets')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        school_id: school.id,
        course_id: course.id,
        division_id: division.id,
        title: '__test__Audit Booklet',
        description: 'Testing audit',
        current_price: 1000,
        stock: 10,
      });

    expect(res.status).toBe(201);
    bookletId = res.body.data.id;

    // Verify audit log was created
    const auditRes = await agent
      .get('/api/admin/audit-logs')
      .set('Authorization', `Bearer ${adminToken}`)
      .query({ entity: 'booklet', limit: 50 });

    expect(auditRes.status).toBe(200);
    const logs = auditRes.body.data?.logs || auditRes.body.logs || [];
    const bookletLog = logs.find((l) => l.entityId === bookletId);
    expect(bookletLog).toBeDefined();
    expect(bookletLog.action).toBe('create');
    expect(bookletLog.entity).toBe('booklet');
  });

  it('GET /admin/audit-logs returns paginated logs', async () => {
    const res = await agent
      .get('/api/admin/audit-logs')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    const body = res.body;
    // Check either { data: { logs } } or { logs } format
    const logs = body.data?.logs || body.logs || [];
    expect(Array.isArray(logs)).toBe(true);
    expect(logs.length).toBeGreaterThanOrEqual(1);
    // Check pagination metadata
    expect(body.pagination.total).toBeGreaterThanOrEqual(1);
  });

  it('GET /admin/audit-logs/stats returns aggregated stats', async () => {
    const res = await agent
      .get('/api/admin/audit-logs/stats')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    const body = res.body;
    const stats = body.data?.stats || body.data || body.stats || [];
    expect(Array.isArray(stats)).toBe(true);
    // At least one action type with count > 0
    const createStat = stats.find((s) => s.action === 'create');
    expect(createStat).toBeDefined();
    expect(createStat.count).toBeGreaterThanOrEqual(1);
  });

  it('rejects non-admin users with 403', async () => {
    const res = await agent
      .get('/api/admin/audit-logs')
      .set('Authorization', `Bearer ${userToken}`);
    expect(res.status).toBe(403);
  });

  it('rejects unauthenticated requests with 401', async () => {
    const res = await agent.get('/api/admin/audit-logs');
    expect(res.status).toBe(401);
  });
});
