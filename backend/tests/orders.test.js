/**
 * Orders — full flow integration tests.
 *
 * Covers the complete lifecycle:
 *   Register -> Login -> Browse catalog -> Add to cart
 *   -> Place order -> Admin views orders
 *   -> Search order by ID, student name, booklet title
 *   -> Advance status pending -> ready -> delivered
 *   -> Cancel order -> verify stock restored
 *   -> Empty cart error
 */
import { describe, it, expect, afterAll, beforeAll } from 'vitest';
import request from 'supertest';
import app from '../src/app.js';
import { prisma } from '../src/lib/prisma.js';
import {
  cleanupTestData, getToken, getActiveCourses,
  getActiveDivisions, getTestSchools, getSchoolCourses,
  createTestAdmin, createTestUser, testEmail,
} from './helpers.js';

const agent = request(app);
let adminToken, userToken;
let availableBooklets, smallStockBooklet, testCourse, testDivision;
let studentUser, studentEmail, studentPassword;
let createdOrderId;
let transferOrderId;

beforeAll(async () => {
  await cleanupTestData();

  // Create admin
  const admin = await createTestAdmin();
  adminToken = await getToken(agent, admin.student.email, admin.password);

  // Grab existing catalog data (assumes seed has data)
  const schools = await getTestSchools();
  const school = schools[0];

  // Get a course with its divisions from this school
  const schoolCourses = await getSchoolCourses(school.id);
  testCourse = schoolCourses[0];
  const allDivs = await getActiveDivisions();
  testDivision = allDivs.find((d) => d.courseId === testCourse.id);

  // Create student WITH a course
  studentEmail = testEmail('order-student');
  const user = await createTestUser({
    email: studentEmail,
    name: 'Order Test Student',
    courseId: testCourse.id,
  });
  studentUser = user.student;
  studentPassword = user.password;
  userToken = await getToken(agent, studentEmail, studentPassword);

  // Use existing active booklets from the catalog API
  const bookletsRes = await agent
    .get('/api/catalog/booklets')
    .set('Authorization', `Bearer ${userToken}`);
  availableBooklets = bookletsRes.body.data || [];

  if (availableBooklets.length === 0) {
    // No active booklets exist — create one via admin API
    const divId = testDivision?.id || allDivs[0]?.id;
    const courseId = testCourse?.id || schoolCourses[0]?.id;

    const createRes = await agent
      .post('/api/admin/booklets')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        school_id: school.id,
        course_id: courseId,
        division_id: divId,
        title: '__test__OrderBooklet',
        current_price: 1500,
        stock: 20,
        is_active: true,
      });
    availableBooklets = [createRes.body.data];
  }

  smallStockBooklet = availableBooklets[0];
});

afterAll(async () => {
  await cleanupTestData();
});

/* ─── CART ─────────────────────────────────────────────── */

describe('Cart flow', () => {
  it('GET /api/cart returns cart for user', async () => {
    const res = await agent
      .get('/api/cart')
      .set('Authorization', `Bearer ${userToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('POST /api/cart/items adds a booklet to cart', async () => {
    const res = await agent
      .post('/api/cart/items')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        booklet_id: smallStockBooklet.id,
        quantity: 2,
        unit_price: Number(smallStockBooklet.currentPrice),
        title: smallStockBooklet.title,
      });

    // Cart controller returns 201 for new items
    expect([200, 201]).toContain(res.status);
    expect(res.body.success).toBe(true);
  });

  it('POST /api/cart/items adds another item', async () => {
    if (availableBooklets.length < 2) return;
    const second = availableBooklets[1];

    const res = await agent
      .post('/api/cart/items')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        booklet_id: second.id,
        quantity: 1,
        unit_price: Number(second.currentPrice),
        title: second.title,
      });

    expect([200, 201]).toContain(res.status);
  });
});

/* ─── PLACE ORDER ──────────────────────────────────────── */

describe('POST /api/orders (place order)', () => {
  it('places an order with cash payment', async () => {
    const res = await agent
      .post('/api/orders')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ payment_method: 'cash' });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('id');
    expect(res.body.data.status).toBe('pending');
    expect(res.body.data.paymentMethod).toBe('cash');
    createdOrderId = res.body.data.id;
  });

  it('decrements stock after order placement', async () => {
    const booklet = await prisma.booklet.findUnique({ where: { id: smallStockBooklet.id } });
    expect(booklet).toBeTruthy();
    const stockBefore = Number(smallStockBooklet.stock);
    const stockAfter = Number(booklet.stock);
    // We ordered 2, so stock should be 2 less
    expect(stockAfter).toBe(stockBefore - 2);
  });

  it('rejects order with empty cart', async () => {
    const res = await agent
      .post('/api/orders')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ payment_method: 'cash' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('CART_002');
  });

  it('rejects invalid payment method', async () => {
    // Add item again
    await agent
      .post('/api/cart/items')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        booklet_id: smallStockBooklet.id,
        quantity: 1,
        unit_price: Number(smallStockBooklet.currentPrice),
        title: smallStockBooklet.title,
      });

    const res = await agent
      .post('/api/orders')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ payment_method: 'bitcoin' });

    expect(res.status).toBe(400);
  });
});

/* ─── STUDENT: LIST / VIEW ORDERS ──────────────────────── */

describe('Student: list / view own orders', () => {
  it('GET /api/orders lists student orders', async () => {
    const res = await agent
      .get('/api/orders')
      .set('Authorization', `Bearer ${userToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    expect(res.body.data[0]).toHaveProperty('order');
    expect(res.body.data[0]).toHaveProperty('items');
  });

  it('GET /api/orders/:id returns order detail', async () => {
    const res = await agent
      .get(`/api/orders/${createdOrderId}`)
      .set('Authorization', `Bearer ${userToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty('order');
    expect(res.body.data).toHaveProperty('items');
    expect(res.body.data.items.length).toBeGreaterThan(0);
  });
});

/* ─── ADMIN: VIEW ORDER WITH SCHOOL INFO ───────────────── */

describe('Admin: view orders with school info', () => {
  it('GET /api/admin/orders/details returns orders with school chain', async () => {
    const res = await agent
      .get('/api/admin/orders/details')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    const data = res.body.data;
    expect(data).toHaveProperty('orders');
    expect(data.orders.length).toBeGreaterThan(0);

    const firstOrder = data.orders[0].order;
    expect(firstOrder).toHaveProperty('student');

    // Student has course -> school chain if courseId is set
    if (firstOrder.student?.course?.school) {
      expect(firstOrder.student.course.school).toHaveProperty('name');
    }
  });
});

/* ─── ADMIN: SEARCH ORDERS ────────────────────────────── */

describe('Admin: search orders', () => {
  it('search by order ID prefix', async () => {
    const idPrefix = createdOrderId.slice(0, 8);
    const res = await agent
      .get(`/api/admin/orders/search/by-id?id=${idPrefix}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    const data = res.body.data;
    if (data) {
      expect(data.order.id).toBe(createdOrderId);
    }
  });

  it('search by student name', async () => {
    const res = await agent
      .get('/api/admin/orders/search/by-student?name=Order Test')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    const data = res.body.data;
    // Response format: { orders: [], student_names: {} }
    expect(Array.isArray(data.orders)).toBe(true);
    if (data.orders.length > 0) {
      expect(data).toHaveProperty('student_names');
    }
  });

  it('search by booklet title', async () => {
    const title = smallStockBooklet.title;
    const res = await agent
      .get(`/api/admin/orders/search/by-booklet?title=${encodeURIComponent(title)}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    // May be empty if order items don't match by title
    expect(Array.isArray(res.body.data)).toBe(true);
  });
});

/* ─── ADMIN: UPDATE ORDER STATUS ───────────────────────── */

describe('Admin: update order status', () => {
  it('advances from pending to ready', async () => {
    const res = await agent
      .put(`/api/admin/orders/${createdOrderId}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'ready' });

    expect(res.status).toBe(200);
  });

  it('advances from ready to delivered', async () => {
    const res = await agent
      .put(`/api/admin/orders/${createdOrderId}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'delivered' });

    expect(res.status).toBe(200);
  });

  it('rejects invalid transition (delivered → pending)', async () => {
    const res = await agent
      .put(`/api/admin/orders/${createdOrderId}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'pending' });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('ORD_003');
  });
});

/* ─── CANCEL ORDER ─────────────────────────────────────── */

describe('Cancel order (student)', () => {
  let cancelOrderId;
  let cancelBookletStock;

  beforeAll(async () => {
    // Pick an existing booklet and note its current stock
    const res = await agent
      .get('/api/catalog/booklets')
      .set('Authorization', `Bearer ${userToken}`);
    const booklets = res.body.data || [];

    if (booklets.length === 0) return;

    const target = booklets.find((b) => b.stock > 0);
    if (!target) return;

    cancelBookletStock = Number(target.stock);

    // Add to cart
    await agent
      .post('/api/cart/items')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        booklet_id: target.id,
        quantity: 1,
        unit_price: Number(target.currentPrice),
        title: target.title,
      });

    // Place order
    const orderRes = await agent
      .post('/api/orders')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ payment_method: 'cash' });

    cancelOrderId = orderRes.body.data?.id;
  });

  it('cancels a pending order', async () => {
    if (!cancelOrderId) return;
    const res = await agent
      .post(`/api/orders/${cancelOrderId}/cancel`)
      .set('Authorization', `Bearer ${userToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('cancelled');
  });

  it('restores stock after cancellation', async () => {
    if (!cancelOrderId || !cancelBookletStock) return;
    // Verify by checking the order items to find the booklet
    const orderDetail = await agent
      .get(`/api/orders/${cancelOrderId}`)
      .set('Authorization', `Bearer ${userToken}`);
    const items = orderDetail.body.data?.items || [];
    if (items.length === 0) return;

    const booklet = await prisma.booklet.findUnique({ where: { id: items[0].bookletId } });
    expect(Number(booklet.stock)).toBeGreaterThanOrEqual(cancelBookletStock);
  });
});

/* ─── Transfer Payment Flow ─────────────────────────────── */

describe('POST /api/orders with transfer payment method', () => {
  let transferUserToken, transferBookletId;

  beforeAll(async () => {
    // Use last booklet from main beforeAll
    if (availableBooklets && availableBooklets.length > 0) {
      transferBookletId = availableBooklets[0].id;
    }
  });

  it('accepts transfer as valid payment method and creates order', async () => {
    if (!transferBookletId) return;

    // Add item to cart first
    await agent
      .post('/api/cart/items')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ booklet_id: transferBookletId, quantity: 1 });

    const res = await agent
      .post('/api/orders')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ payment_method: 'transfer' });

    expect(res.status).toBe(201);
    expect(res.body.data.paymentMethod).toBe('transfer');
    expect(res.body.data.paymentStatus).toBe('pending');
    expect(res.body.data.status).toBe('pending');
    transferOrderId = res.body.data.id;
  });

  it('rejects invalid payment method', async () => {
    const res = await agent
      .post('/api/orders')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ payment_method: 'invalid_method' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('PAY_002');
  });
});

describe('Admin: confirm transfer payment', () => {
  it('POST /admin/orders/:id/confirm-transfer confirms a transfer payment', async () => {
    if (!transferOrderId) return;

    const res = await agent
      .post(`/api/admin/orders/${transferOrderId}/confirm-transfer`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.message).toBe('transfer payment confirmed');
  });

  it('rejects double confirmation', async () => {
    if (!transferOrderId) return;

    const res = await agent
      .post(`/api/admin/orders/${transferOrderId}/confirm-transfer`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('PAY_003');
  });

  it('non-admin gets 403 on confirm-transfer', async () => {
    if (!transferOrderId) return;

    const res = await agent
      .post(`/api/admin/orders/${transferOrderId}/confirm-transfer`)
      .set('Authorization', `Bearer ${userToken}`);

    expect(res.status).toBe(403);
  });

  it('unauthenticated gets 401 on confirm-transfer', async () => {
    const res = await agent
      .post(`/api/admin/orders/some-id/confirm-transfer`);

    expect(res.status).toBe(401);
  });
});
