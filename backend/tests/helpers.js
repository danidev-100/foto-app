/**
 * Test helpers — centralised utilities for test data creation and cleanup.
 * Uses its own Prisma client instance to avoid import-order issues.
 */
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';

// Create a dedicated Prisma client for test helpers (minimal logging)
const prisma = new PrismaClient({ log: ['error'] });

const TEST_PREFIX = '__test__';

/** Generate a unique test email */
export const testEmail = (label = 'user') =>
  `${TEST_PREFIX}${label}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}@test.com`;

/** Create a test student (non-admin) — returns full user + the raw password */
export async function createTestUser(overrides = {}) {
  const password = overrides.password || 'Password123!';
  const hash = await bcrypt.hash(password, 6);
  const student = await prisma.student.create({
    data: {
      id: uuidv4(),
      name: overrides.name || `Test User ${Date.now()}`,
      email: overrides.email || testEmail(),
      passwordHash: hash,
      courseId: overrides.courseId ?? null,
      isAdmin: overrides.isAdmin ?? false,
      isActive: true,
    },
  });
  return { student, password };
}

/** Create an admin user */
export async function createTestAdmin(overrides = {}) {
  return createTestUser({ ...overrides, isAdmin: true });
}

/** Get existing schools from the DB */
export async function getTestSchools() {
  return prisma.school.findMany({ orderBy: { name: 'asc' } });
}

/** Get courses for a specific school */
export async function getSchoolCourses(schoolId) {
  return prisma.course.findMany({
    where: { schoolId, isActive: true },
    include: { divisions: { where: { isActive: true } } },
    orderBy: { name: 'asc' },
  });
}

/** Get existing courses (active) */
export async function getActiveCourses() {
  return prisma.course.findMany({ where: { isActive: true }, orderBy: { name: 'asc' } });
}

/** Get all active divisions */
export async function getActiveDivisions() {
  return prisma.division.findMany({ where: { isActive: true }, orderBy: { name: 'asc' } });
}

/** Create a test booklet */
export async function createTestBooklet({ schoolId, courseId, divisionId, overrides = {} }) {
  return prisma.booklet.create({
    data: {
      id: uuidv4(),
      schoolId,
      courseId,
      divisionId,
      title: overrides.title || `Test Booklet ${Date.now()}`,
      description: overrides.description || 'Test description',
      currentPrice: overrides.currentPrice ?? 1500,
      stock: overrides.stock ?? 100,
      isActive: overrides.isActive ?? true,
    },
  });
}

/** Create a cart for a student (if not exists) */
export async function ensureCart(studentId) {
  const existing = await prisma.cart.findUnique({ where: { studentId } });
  if (existing) return existing;
  return prisma.cart.create({ data: { studentId } });
}

/** Add an item to cart */
export async function addCartItem(cartId, booklet, quantity = 2) {
  return prisma.cartItem.create({
    data: {
      cartId,
      bookletId: booklet.id,
      quantity,
      unitPrice: booklet.currentPrice,
      title: booklet.title,
    },
  });
}

/** Login and get a JWT token via the API */
export async function getToken(agent, email, password) {
  const res = await agent
    .post('/api/auth/login')
    .send({ email, password });
  return res.body.data?.token || null;
}

/** Cleanup: remove all test entities created during tests */
export async function cleanupTestData() {
  // Order matters — CASCADE might not handle everything
  const testStudents = await prisma.student.findMany({
    where: { email: { contains: TEST_PREFIX } },
    select: { id: true },
  });
  const testStudentIds = testStudents.map((s) => s.id);

  if (testStudentIds.length > 0) {
    // Delete carts
    await prisma.cartItem.deleteMany({
      where: { cart: { studentId: { in: testStudentIds } } },
    });
    await prisma.cart.deleteMany({
      where: { studentId: { in: testStudentIds } },
    });
    // Delete orders and order items
    const testOrders = await prisma.order.findMany({
      where: { studentId: { in: testStudentIds } },
      select: { id: true },
    });
    const testOrderIds = testOrders.map((o) => o.id);
    if (testOrderIds.length > 0) {
      await prisma.orderItem.deleteMany({ where: { orderId: { in: testOrderIds } } });
      await prisma.payment.deleteMany({ where: { orderId: { in: testOrderIds } } });
      await prisma.order.deleteMany({ where: { id: { in: testOrderIds } } });
    }
    await prisma.student.deleteMany({ where: { id: { in: testStudentIds } } });
  }

  // Delete test booklets
  await prisma.booklet.deleteMany({
    where: { title: { contains: TEST_PREFIX } },
  });

  // Delete test courses (will cascade delete test divisions)
  await prisma.course.deleteMany({
    where: { name: { contains: TEST_PREFIX } },
  });
}
