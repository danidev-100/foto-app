/**
 * Booklet Progress Tracking — integration tests for progress endpoints.
 *
 * Covers:
 *  - Auto-create progress records on booklet creation
 *  - GET  /api/admin/progress          — summary with counts
 *  - GET  /api/admin/progress?school_id= — filtered by school
 *  - GET  /api/admin/progress/:bookletId — student detail
 *  - GET  /api/admin/progress/:nonexistent — 404
 *  - PATCH /api/admin/progress/:id      — toggle status
 *  - PATCH with invalid status          — 400
 *  - PATCH non-existent record          — 404
 *  - Non-admin user                     — 403
 *  - Unauthenticated                    — 401
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
let testBookletId, testProgressId, testStudents;
let secondSchool, secondCourse, secondDivision;

beforeAll(async () => {
  await cleanupTestData();
  const admin = await createTestAdmin();
  adminToken = await getToken(agent, admin.student.email, admin.password);
  const user = await createTestUser();
  userToken = await getToken(agent, user.student.email, user.password);

  schools = await getTestSchools();
  if (schools.length === 0) {
    throw new Error('No schools found in DB. Run seed first.');
  }
  adminSchool = schools[0];
  secondSchool = schools.length > 1 ? schools[1] : schools[0];

  const schoolCourses = await getSchoolCourses(adminSchool.id);
  adminCourse = schoolCourses[0];
  const allDivs = await getActiveDivisions();
  adminDivision = allDivs.find((d) => d.courseId === adminCourse?.id);

  // Get second school course/division for school filter tests
  const secondSchoolCourses = await getSchoolCourses(secondSchool.id);
  secondCourse = secondSchoolCourses[0];
  secondDivision = allDivs.find((d) => d.courseId === secondCourse?.id);

  // Create test students in the first course
  testStudents = [];
  for (let i = 0; i < 3; i++) {
    const { student } = await createTestUser({ courseId: adminCourse.id });
    testStudents.push(student);
  }
});

afterAll(async () => {
  await cleanupTestData();
});

/* ─── SCENARIOS ────────────────────────────────────────── */

describe('Progress endpoints', () => {
  it('POST booklet auto-creates progress records for course students', async () => {
    if (!adminCourse || !adminDivision) return;
    const res = await agent
      .post('/api/admin/booklets')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        school_id: adminSchool.id,
        course_id: adminCourse.id,
        division_id: adminDivision.id,
        title: '__test__Progress Booklet',
        description: 'Testing auto-creation',
        current_price: 2000,
        stock: 50,
      });

    expect(res.status).toBe(201);
    testBookletId = res.body.data.id;

    // Verify progress records were created
    const records = await prisma.studentBookletProgress.findMany({
      where: { bookletId: testBookletId },
    });
    expect(records.length).toBe(testStudents.length);
    records.forEach((r) => expect(r.status).toBe('pending'));
  });

  it('GET /admin/progress returns summary with correct counts', async () => {
    const res = await agent
      .get('/api/admin/progress')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);

    const entry = res.body.data.find((b) => b.booklet_id === testBookletId);
    expect(entry).toBeTruthy();
    expect(entry.total_students).toBe(testStudents.length);
    expect(entry.completed).toBe(0);
    expect(entry.pending).toBe(testStudents.length);
    expect(entry.percentage).toBe(0);
    expect(entry).toHaveProperty('booklet_title');
    expect(entry).toHaveProperty('course_name');
    expect(entry).toHaveProperty('school_name');
  });

  it('GET /admin/progress filters by school_id', async () => {
    const res = await agent
      .get(`/api/admin/progress?school_id=${adminSchool.id}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThan(0);
    res.body.data.forEach((b) => {
      expect(b.school_name).toBe(adminSchool.name);
    });
  });

  it('GET /admin/progress with school_id from other school returns no cross-school data', async () => {
    // Create a booklet in second school with no students
    if (secondCourse && secondDivision) {
      const res2 = await agent
        .post('/api/admin/booklets')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          school_id: secondSchool.id,
          course_id: secondCourse.id,
          division_id: secondDivision.id,
          title: '__test__Second School Booklet',
          description: 'Test',
          current_price: 1500,
          stock: 10,
        });
      expect(res2.status).toBe(201);
    }

    const res = await agent
      .get(`/api/admin/progress?school_id=${secondSchool.id}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    // Should only have second school booklet
    res.body.data.forEach((b) => {
      expect(b.school_name).toBe(secondSchool.name);
    });
  });

  it('GET /admin/progress/:bookletId returns students with statuses', async () => {
    const res = await agent
      .get(`/api/admin/progress/${testBookletId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.students.length).toBe(testStudents.length);
    expect(res.body.data).toHaveProperty('booklet_id');
    expect(res.body.data).toHaveProperty('booklet_title');
    expect(res.body.data.students[0]).toHaveProperty('progress_id');
    expect(res.body.data.students[0]).toHaveProperty('student_name');
    expect(res.body.data.students[0]).toHaveProperty('status');
    testProgressId = res.body.data.students[0].progress_id;
  });

  it('GET /admin/progress/:nonexistent returns 404 with PROG_001', async () => {
    const res = await agent
      .get('/api/admin/progress/non-existent-id')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('PROG_001');
  });

  it('PATCH /admin/progress/:id toggles status to completed', async () => {
    if (!testProgressId) return;
    const res = await agent
      .patch(`/api/admin/progress/${testProgressId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'completed' });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('completed');
    // Verify response includes id
    expect(res.body.data).toHaveProperty('id');
    expect(res.body.data).toHaveProperty('student_id');
    expect(res.body.data).toHaveProperty('booklet_id');
  });

  it('PATCH with invalid status value returns 400 with PROG_002', async () => {
    if (!testProgressId) return;
    const res = await agent
      .patch(`/api/admin/progress/${testProgressId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'invalid' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('PROG_002');
  });

  it('PATCH non-existent progress record returns 404 with PROG_003', async () => {
    const res = await agent
      .patch('/api/admin/progress/non-existent-id')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'completed' });

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('PROG_003');
  });

  it('Non-admin user gets 403 on progress endpoints', async () => {
    const res = await agent
      .get('/api/admin/progress')
      .set('Authorization', `Bearer ${userToken}`);

    expect(res.status).toBe(403);
  });

  it('Unauthenticated request returns 401 on progress endpoints', async () => {
    const res = await agent.get('/api/admin/progress');
    expect(res.status).toBe(401);
  });
});
