/**
 * CheckoutService unit tests — mock Prisma + gateway.
 *
 * Tests:
 *   - initMPCheckout creates pending checkout
 *   - initMPCheckout returns error for empty cart
 *   - initMPCheckout returns error for insufficient stock
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock prisma before any imports that use it
const mockTx = {
  cart: { findFirst: vi.fn() },
  cartItem: { findMany: vi.fn() },
  booklet: { findFirst: vi.fn() },
  pendingCheckout: { create: vi.fn(), update: vi.fn() },
};

vi.mock('../src/lib/prisma.js', () => ({
  prisma: {
    $transaction: vi.fn(),
  },
}));

const { prisma } = await import('../src/lib/prisma.js');
const { CheckoutService } = await import('../src/services/checkout.service.js');

function makeService(gateway) {
  const gw = gateway || { createPreference: vi.fn() };
  return new CheckoutService(gw);
}

beforeEach(() => {
  vi.clearAllMocks();
});

/* ─── initMPCheckout ───────────────────────────────────── */

describe('initMPCheckout', () => {
  const studentId = 'student-1';
  const cartId = 'cart-1';

  it('creates a pending checkout and returns payment URL', async () => {
    // Mock transaction to execute callback with mockTx
    prisma.$transaction.mockImplementation(async (cb) => cb(mockTx));

    mockTx.cart.findFirst.mockResolvedValue({ id: cartId });
    mockTx.cartItem.findMany.mockResolvedValue([
      {
        id: 'item-1', bookletId: 'b1', title: 'Test Booklet',
        quantity: 2, unitPrice: 1500, deliveryDays: 3,
      },
    ]);
    mockTx.booklet.findFirst.mockResolvedValue({ stock: 10, isActive: true });
    mockTx.pendingCheckout.create.mockResolvedValue({
      id: 'pc-1', studentId, total: 3000, items: [],
    });

    const gateway = { createPreference: vi.fn().mockResolvedValue({ id: 'mp-pref-1', initPoint: 'https://mp.com/pay/123' }) };
    const svc = makeService(gateway);

    const result = await svc.initMPCheckout(studentId);

    expect(result.checkoutId).toBe('pc-1');
    expect(result.paymentUrl).toBe('https://mp.com/pay/123');
    expect(gateway.createPreference).toHaveBeenCalled();
    expect(mockTx.pendingCheckout.update).toHaveBeenCalledWith({
      where: { id: 'pc-1' },
      data: { mpPreferenceId: 'mp-pref-1' },
    });
  });

  it('returns error for empty cart (no cart record)', async () => {
    prisma.$transaction.mockImplementation(async (cb) => cb(mockTx));
    mockTx.cart.findFirst.mockResolvedValue(null);

    const svc = makeService();
    await expect(
      svc.initMPCheckout(studentId),
    ).rejects.toMatchObject({ code: 'CART_002', status: 400 });
  });

  it('returns error for empty cart (no items)', async () => {
    prisma.$transaction.mockImplementation(async (cb) => cb(mockTx));
    mockTx.cart.findFirst.mockResolvedValue({ id: cartId });
    mockTx.cartItem.findMany.mockResolvedValue([]);

    const svc = makeService();
    await expect(
      svc.initMPCheckout(studentId),
    ).rejects.toMatchObject({ code: 'CART_002', status: 400 });
  });

  it('returns error when booklet is inactive', async () => {
    prisma.$transaction.mockImplementation(async (cb) => cb(mockTx));
    mockTx.cart.findFirst.mockResolvedValue({ id: cartId });
    mockTx.cartItem.findMany.mockResolvedValue([
      { id: 'item-1', bookletId: 'b1', title: 'Inactive', quantity: 1, unitPrice: 1000 },
    ]);
    mockTx.booklet.findFirst.mockResolvedValue({ stock: 5, isActive: false });

    const svc = makeService();
    await expect(
      svc.initMPCheckout(studentId),
    ).rejects.toMatchObject({ code: 'CART_001', status: 400 });
  });

  it('returns error for insufficient stock', async () => {
    prisma.$transaction.mockImplementation(async (cb) => cb(mockTx));
    mockTx.cart.findFirst.mockResolvedValue({ id: cartId });
    mockTx.cartItem.findMany.mockResolvedValue([
      { id: 'item-1', bookletId: 'b1', title: 'Low Stock', quantity: 10, unitPrice: 1000 },
    ]);
    mockTx.booklet.findFirst.mockResolvedValue({ stock: 3, isActive: true });

    const svc = makeService();
    await expect(
      svc.initMPCheckout(studentId),
    ).rejects.toMatchObject({ code: 'CART_001', status: 400 });
  });
});
