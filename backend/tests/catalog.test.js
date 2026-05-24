/**
 * Catalog & Admin CRUD — tests for schools, courses, divisions, booklets.
 *
 * Covers:
 *  - GET  /api/catalog/schools       — list active schools with courses
 *  - GET  /api/catalog/courses       — list active courses
 *  - GET  /api/catalog/courses/:id/divisions — divisions by course
 *  - GET  /api/catalog/booklets      — student-facing list
 *  - GET  /api/admin/schools         — admin schools with courses
 *  - POST /api/admin/divisions       — create division (admin)
 *  - POST /api/admin/booklets        — create booklet with schoolId (admin)
 *  - PUT  /api/admin/booklets/:id    — update booklet (admin)
 *  - DELETE /api/admin/booklets/:id  — delete booklet (admin)
 *  - Admin booklet list includes school info
 *  - Course has schoolId field (1:N)
 */
import { describe, it, expect, afterAll, beforeAll } from 'vitest';
import request from 'supertest';
import app from '../src/app.js';
import { prisma } from '../src/lib/prisma.js';
import {
  cleanupTestData, getToken, getActiveCourses,
  getActiveDivisions, getTestSchools, getSchoolCourses,
  createTestAdmin, createTestUser,
} from './helpers.js';

const agent = request(app);
let adminToken, userToken, schools, adminSchool, adminCourse, adminDivision;

beforeAll(async () => {
  await cleanupTestData();
  const admin = await createTestAdmin();
  adminToken = await getToken(agent, admin.student.email, admin.password);
  const user = await createTestUser();
  userToken = await getToken(agent, user.student.email, user.password);

  // Get existing data (assumes DB is seeded)
  schools = await getTestSchools();
  if (schools.length === 0) {
    throw new Error('No schools found in DB. Run seed first.');
  }
  adminSchool = schools[0];
  const schoolCourses = await getSchoolCourses(adminSchool.id);
  adminCourse = schoolCourses[0];
  const allDivs = await getActiveDivisions();
  adminDivision = allDivs.find((d) => d.courseId === adminCourse?.id);
});

afterAll(async () => {
  await cleanupTestData();
});

/* ─── CATALOG (STUDENT-FACING) ────────────────────────── */

describe('GET /api/catalog/schools (student-facing)', () => {
  it('returns schools with nested courses', async () => {
    const res = await agent.get('/api/catalog/schools');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);

    // Should have at least Don Bosco and Instituto
    const db = res.body.data.find((s) => s.name.includes('Don Bosco'));
    expect(db).toBeTruthy();

    // School should include courses directly on the school object
    const first = res.body.data[0];
    expect(first).toHaveProperty('id');
    expect(first).toHaveProperty('name');
    expect(first).toHaveProperty('courses');
    expect(Array.isArray(first.courses)).toBe(true);

    // Each course in the school should have schoolId (1:N)
    if (first.courses.length > 0) {
      expect(first.courses[0]).toHaveProperty('schoolId');
      expect(first.courses[0].schoolId).toBe(first.id);
    }
  });
});

describe('GET /api/catalog/courses', () => {
  it('returns active courses', async () => {
    const res = await agent.get('/api/catalog/courses');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.length).toBeGreaterThan(0);
  });
});

describe('GET /api/catalog/courses/:id/divisions', () => {
  it('returns divisions for a valid course', async () => {
    const courses = await getActiveCourses();
    if (courses.length === 0) return;

    const res = await agent.get(`/api/catalog/courses/${courses[0].id}/divisions`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('returns 404 for non-existent course', async () => {
    const res = await agent.get('/api/catalog/courses/non-existent-id/divisions');
    expect(res.status).toBe(404);
  });
});

describe('GET /api/catalog/booklets (student)', () => {
  it('returns paginated active booklets', async () => {
    const token = userToken || adminToken;
    const res = await agent
      .get('/api/catalog/booklets')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body).toHaveProperty('pagination');
    expect(res.body.pagination).toHaveProperty('total_pages');
  });

  it('filters by course_id', async () => {
    const courses = await getActiveCourses();
    if (courses.length === 0) return;

    const res = await agent
      .get(`/api/catalog/booklets?course_id=${courses[0].id}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
  });
});

/* ─── ADMIN: DIVISIONS CRUD ───────────────────────────── */

describe('Admin: Divisions CRUD', () => {
  let createdDivId;

  it('POST /api/admin/divisions creates a division', async () => {
    if (!adminCourse) return; // skip if no course available
    const res = await agent
      .post('/api/admin/divisions')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ course_id: adminCourse.id, name: '__test__DivA' });

    expect(res.status).toBe(201);
    expect(res.body.data.name).toBe('__test__DivA');
    createdDivId = res.body.data.id;
  });

  it('PUT /api/admin/divisions/:id updates division', async () => {
    if (!createdDivId) return;
    const res = await agent
      .put(`/api/admin/divisions/${createdDivId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ course_id: adminCourse.id, name: '__test__DivB' });

    expect(res.status).toBe(200);
    expect(res.body.data.name).toBe('__test__DivB');
  });

  it('DELETE /api/admin/divisions/:id deletes division', async () => {
    if (!createdDivId) return;
    const res = await agent
      .delete(`/api/admin/divisions/${createdDivId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
  });
});

/* ─── ADMIN: BOOKLETS CRUD ────────────────────────────── */

describe('Admin: Booklets CRUD (with schoolId)', () => {
  let testBookletId;

  it('POST /api/admin/booklets creates a booklet with school', async () => {
    if (!adminCourse || !adminDivision) return;
    const res = await agent
      .post('/api/admin/booklets')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        school_id: adminSchool.id,
        course_id: adminCourse.id,
        division_id: adminDivision.id,
        title: '__test__Booklet Alpha',
        description: 'Test booklet with school',
        current_price: 2000,
        stock: 50,
        is_active: true,
      });

    expect(res.status).toBe(201);
    expect(res.body.data.schoolId).toBe(adminSchool.id);
    expect(res.body.data.courseId).toBe(adminCourse.id);
    testBookletId = res.body.data.id;
  });

  it('GET /api/admin/booklets includes school data', async () => {
    if (!testBookletId) return;
    const res = await agent
      .get('/api/admin/booklets')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    const created = res.body.data.find((b) => b.id === testBookletId);
    expect(created).toBeTruthy();
    expect(created).toHaveProperty('school');
    expect(created).toHaveProperty('course');
    expect(created.school).toHaveProperty('name');
  });

  it('PUT /api/admin/booklets/:id updates the booklet', async () => {
    if (!testBookletId) return;
    const res = await agent
      .put(`/api/admin/booklets/${testBookletId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        course_id: adminCourse.id,
        division_id: adminDivision.id,
        title: '__test__Booklet Alpha Updated',
        current_price: 2500,
      });

    expect(res.status).toBe(200);
    expect(res.body.data.title).toBe('__test__Booklet Alpha Updated');
  });

  it('DELETE /api/admin/booklets/:id deletes the booklet', async () => {
    if (!testBookletId) return;
    const res = await agent
      .delete(`/api/admin/booklets/${testBookletId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
  });

  it('validates required fields on create', async () => {
    const res = await agent
      .post('/api/admin/booklets')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ title: 'Missing school' });

    expect(res.status).toBe(400);
  });
});

/* ─── ADMIN: SCHOOLS LIST ─────────────────────────────── */

describe('GET /api/admin/schools', () => {
  it('returns schools with courses data', async () => {
    const res = await agent
      .get('/api/admin/schools')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.length).toBeGreaterThanOrEqual(2);

    const db = res.body.data.find((s) => s.name.includes('Don Bosco'));
    expect(db).toBeTruthy();
    expect(Array.isArray(db.courses)).toBe(true);
    expect(db.courses.length).toBeGreaterThan(0);
  });
});
