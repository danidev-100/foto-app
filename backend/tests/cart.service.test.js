/**
 * CartService unit tests — mock Prisma.
 *
 * Tests:
 *   - addItem adds item to cart
 *   - addItem creates cart if doesn't exist
 *   - addItem returns error for non-existent booklet
 *   - addItem returns error for insufficient stock
 *   - updateItem updates quantity
 *   - removeItem removes item
 *   - clearCart clears all items
 *   - getCart returns cart or empty state
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock prisma before any imports that use it
vi.mock('../src/lib/prisma.js', () => ({
  prisma: {
    booklet: { findUnique: vi.fn() },
    cart: { findUnique: vi.fn(), create: vi.fn() },
    cartItem: { findUnique: vi.fn(), update: vi.fn(), updateMany: vi.fn(), create: vi.fn(), findMany: vi.fn(), deleteMany: vi.fn() },
  },
}));

const { prisma } = await import('../src/lib/prisma.js');
const { CartService } = await import('../src/services/cart.service.js');

function makeService() {
  return new CartService();
}

beforeEach(() => {
  vi.clearAllMocks();
});

/* ─── addItem ──────────────────────────────────────────── */

describe('addItem', () => {
  const studentId = 'student-1';
  const bookletId = 'booklet-1';
  const cartId = 'cart-1';

  it('adds item to existing cart', async () => {
    prisma.booklet.findUnique.mockResolvedValue({
      id: bookletId, title: 'Test Booklet', currentPrice: 1500, stock: 10,
    });
    prisma.cart.findUnique.mockResolvedValue({ id: cartId, studentId });
    prisma.cartItem.findUnique.mockResolvedValue(null); // no existing item
    prisma.cartItem.create.mockResolvedValue({
      id: 'item-1', cartId, bookletId, quantity: 2, unitPrice: 1500, title: 'Test Booklet',
    });
    prisma.cartItem.findMany.mockResolvedValue([
      { id: 'item-1', cartId, bookletId, title: 'Test Booklet', quantity: 2, unitPrice: 1500 },
    ]);

    const svc = makeService();
    const result = await svc.addItem(studentId, { bookletId, quantity: 2 });

    expect(prisma.cartItem.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ cartId, bookletId, quantity: 2 }),
      }),
    );
    expect(result.items.length).toBe(1);
    expect(result.total).toBe(3000);
  });

  it('creates a cart if it does not exist', async () => {
    prisma.booklet.findUnique.mockResolvedValue({
      id: bookletId, title: 'New Cart', currentPrice: 2000, stock: 5,
    });
    prisma.cart.findUnique.mockResolvedValue(null); // no cart
    prisma.cart.create.mockResolvedValue({ id: cartId, studentId });
    prisma.cartItem.findUnique.mockResolvedValue(null);
    prisma.cartItem.create.mockResolvedValue({
      id: 'item-1', cartId, bookletId, quantity: 1, unitPrice: 2000,
    });
    prisma.cartItem.findMany.mockResolvedValue([
      { id: 'item-1', cartId, bookletId, title: 'New Cart', quantity: 1, unitPrice: 2000 },
    ]);

    const svc = makeService();
    const result = await svc.addItem(studentId, { bookletId, quantity: 1 });

    expect(prisma.cart.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ studentId }) }),
    );
    expect(result.items.length).toBe(1);
  });

  it('returns error for non-existent booklet', async () => {
    prisma.booklet.findUnique.mockResolvedValue(null);

    const svc = makeService();
    await expect(
      svc.addItem(studentId, { bookletId: 'nonexistent', quantity: 1 }),
    ).rejects.toMatchObject({ code: 'CAT_003', status: 404 });
  });

  it('returns error for insufficient stock', async () => {
    prisma.booklet.findUnique.mockResolvedValue({
      id: bookletId, title: 'Low Stock', currentPrice: 1000, stock: 1,
    });

    const svc = makeService();
    await expect(
      svc.addItem(studentId, { bookletId, quantity: 5 }),
    ).rejects.toMatchObject({ code: 'CART_001', status: 400 });
  });

  it('increments quantity when item already in cart', async () => {
    prisma.booklet.findUnique.mockResolvedValue({
      id: bookletId, title: 'Existing', currentPrice: 1000, stock: 10,
    });
    prisma.cart.findUnique.mockResolvedValue({ id: cartId, studentId });
    prisma.cartItem.findUnique.mockResolvedValue({
      id: 'item-1', cartId, bookletId, quantity: 2, unitPrice: 1000,
    });
    prisma.cartItem.update.mockResolvedValue({
      id: 'item-1', cartId, bookletId, quantity: 5, unitPrice: 1000,
    });
    prisma.cartItem.findMany.mockResolvedValue([
      { id: 'item-1', cartId, bookletId, title: 'Existing', quantity: 5, unitPrice: 1000 },
    ]);

    const svc = makeService();
    const result = await svc.addItem(studentId, { bookletId, quantity: 3 });

    expect(prisma.cartItem.update).toHaveBeenCalled();
    expect(result.items[0].quantity).toBe(5);
  });

  it('returns error when total quantity exceeds stock', async () => {
    prisma.booklet.findUnique.mockResolvedValue({
      id: bookletId, title: 'Almost Out', currentPrice: 1000, stock: 5,
    });
    prisma.cart.findUnique.mockResolvedValue({ id: cartId, studentId });
    prisma.cartItem.findUnique.mockResolvedValue({
      id: 'item-1', cartId, bookletId, quantity: 4, unitPrice: 1000,
    });

    const svc = makeService();
    await expect(
      svc.addItem(studentId, { bookletId, quantity: 2 }),
    ).rejects.toMatchObject({ code: 'CART_001', status: 400 });
  });
});

/* ─── updateItem ───────────────────────────────────────── */

describe('updateItem', () => {
  const studentId = 'student-1';
  const bookletId = 'booklet-1';
  const cartId = 'cart-1';

  it('updates item quantity', async () => {
    prisma.booklet.findUnique.mockResolvedValue({
      id: bookletId, title: 'Test', currentPrice: 1500, stock: 10,
    });
    prisma.cart.findUnique.mockResolvedValue({ id: cartId, studentId });
    prisma.cartItem.updateMany.mockResolvedValue({ count: 1 });
    prisma.cartItem.findMany.mockResolvedValue([
      { id: 'item-1', cartId, bookletId, title: 'Test', quantity: 3, unitPrice: 1500 },
    ]);

    const svc = makeService();
    const result = await svc.updateItem(studentId, bookletId, { quantity: 3 });

    expect(prisma.cartItem.updateMany).toHaveBeenCalledWith({
      where: { cartId, bookletId },
      data: { quantity: 3 },
    });
    expect(result.items[0].quantity).toBe(3);
  });

  it('returns error when booklet not found', async () => {
    prisma.booklet.findUnique.mockResolvedValue(null);

    const svc = makeService();
    await expect(
      svc.updateItem(studentId, 'nonexistent', { quantity: 1 }),
    ).rejects.toMatchObject({ code: 'CAT_003', status: 404 });
  });

  it('returns error for insufficient stock', async () => {
    prisma.booklet.findUnique.mockResolvedValue({
      id: bookletId, title: 'Low', currentPrice: 1000, stock: 2,
    });

    const svc = makeService();
    await expect(
      svc.updateItem(studentId, bookletId, { quantity: 10 }),
    ).rejects.toMatchObject({ code: 'CART_001', status: 400 });
  });

  it('returns error when cart not found', async () => {
    prisma.booklet.findUnique.mockResolvedValue({
      id: bookletId, title: 'Test', currentPrice: 1500, stock: 10,
    });
    prisma.cart.findUnique.mockResolvedValue(null);

    const svc = makeService();
    await expect(
      svc.updateItem(studentId, bookletId, { quantity: 2 }),
    ).rejects.toMatchObject({ code: 'INF_001', status: 404 });
  });

  it('returns error when item not in cart', async () => {
    prisma.booklet.findUnique.mockResolvedValue({
      id: bookletId, title: 'Test', currentPrice: 1500, stock: 10,
    });
    prisma.cart.findUnique.mockResolvedValue({ id: cartId, studentId });
    prisma.cartItem.updateMany.mockResolvedValue({ count: 0 });

    const svc = makeService();
    await expect(
      svc.updateItem(studentId, bookletId, { quantity: 2 }),
    ).rejects.toMatchObject({ code: 'INF_001', status: 404 });
  });

  it('validates quantity is positive', async () => {
    const svc = makeService();
    await expect(
      svc.updateItem(studentId, bookletId, { quantity: 0 }),
    ).rejects.toMatchObject({ code: 'AUTH_004', status: 400 });
  });
});

/* ─── removeItem ───────────────────────────────────────── */

describe('removeItem', () => {
  const studentId = 'student-1';
  const bookletId = 'booklet-1';
  const cartId = 'cart-1';

  it('removes item from cart', async () => {
    prisma.cart.findUnique.mockResolvedValue({ id: cartId, studentId });
    prisma.cartItem.deleteMany.mockResolvedValue({ count: 1 });
    prisma.cartItem.findMany.mockResolvedValue([]);

    const svc = makeService();
    const result = await svc.removeItem(studentId, bookletId);

    expect(prisma.cartItem.deleteMany).toHaveBeenCalledWith({
      where: { cartId, bookletId },
    });
    expect(result.items).toEqual([]);
  });

  it('returns error when cart not found', async () => {
    prisma.cart.findUnique.mockResolvedValue(null);

    const svc = makeService();
    await expect(
      svc.removeItem(studentId, bookletId),
    ).rejects.toMatchObject({ code: 'INF_001', status: 404 });
  });

  it('returns error when item not found', async () => {
    prisma.cart.findUnique.mockResolvedValue({ id: cartId, studentId });
    prisma.cartItem.deleteMany.mockResolvedValue({ count: 0 });

    const svc = makeService();
    await expect(
      svc.removeItem(studentId, bookletId),
    ).rejects.toMatchObject({ code: 'INF_001', status: 404 });
  });
});

/* ─── clearCart ────────────────────────────────────────── */

describe('clearCart', () => {
  const studentId = 'student-1';
  const cartId = 'cart-1';

  it('clears all items from cart', async () => {
    prisma.cart.findUnique.mockResolvedValue({ id: cartId, studentId });

    const svc = makeService();
    await svc.clear(studentId);

    expect(prisma.cartItem.deleteMany).toHaveBeenCalledWith({
      where: { cartId },
    });
  });

  it('does nothing when cart does not exist', async () => {
    prisma.cart.findUnique.mockResolvedValue(null);

    const svc = makeService();
    await svc.clear(studentId);

    expect(prisma.cartItem.deleteMany).not.toHaveBeenCalled();
  });
});

/* ─── getCart ──────────────────────────────────────────── */

describe('getCart', () => {
  const studentId = 'student-1';
  const cartId = 'cart-1';

  it('returns cart with items', async () => {
    prisma.cart.findUnique.mockResolvedValue({ id: cartId, studentId });
    prisma.cartItem.findMany.mockResolvedValue([
      { id: 'item-1', cartId, bookletId: 'b1', title: 'Booklet 1', quantity: 2, unitPrice: 1500 },
      { id: 'item-2', cartId, bookletId: 'b2', title: 'Booklet 2', quantity: 1, unitPrice: 2000 },
    ]);

    const svc = makeService();
    const result = await svc.getCart(studentId);

    expect(result.items.length).toBe(2);
    expect(result.total).toBe(5000); // 2*1500 + 1*2000
    expect(result.studentId).toBe(studentId);
  });

  it('returns empty state when no cart exists', async () => {
    prisma.cart.findUnique.mockResolvedValue(null);

    const svc = makeService();
    const result = await svc.getCart(studentId);

    expect(result.items).toEqual([]);
    expect(result.total).toBe(0);
    expect(result.studentId).toBe(studentId);
  });
});
