/**
 * OrderService unit tests — mock Prisma.
 *
 * Tests for:
 *   - adminUpdateOrderItemStatus() state machine
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OrderService } from '../src/services/order.service.js';

// Mock prisma before any imports that use it
vi.mock('../src/lib/prisma.js', () => ({
  prisma: {
    orderItem: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    order: {
      findUnique: vi.fn(),
      updateMany: vi.fn(),
    },
    booklet: {
      update: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

const { prisma } = await import('../src/lib/prisma.js');

function makeService() {
  return new OrderService();
}

beforeEach(() => {
  vi.clearAllMocks();
});

/* ─── adminUpdateOrderItemStatus ───────────────────────── */

describe('adminUpdateOrderItemStatus', () => {
  it('advances item from pending to ready', async () => {
    prisma.orderItem.findFirst.mockResolvedValue({
      id: 'item-1',
      orderId: 'order-1',
      bookletId: 'booklet-1',
      title: 'Test Booklet',
      quantity: 2,
      unitPrice: 15.00,
      status: 'pending',
    });
    prisma.orderItem.update.mockResolvedValue({
      id: 'item-1',
      orderId: 'order-1',
      bookletId: 'booklet-1',
      title: 'Test Booklet',
      quantity: 2,
      unitPrice: 15.00,
      status: 'ready',
    });

    const svc = makeService();
    const result = await svc.adminUpdateOrderItemStatus('order-1', 'item-1', 'ready');

    expect(result.status).toBe('ready');
    expect(prisma.orderItem.update).toHaveBeenCalledWith({
      where: { id: 'item-1' },
      data: { status: 'ready' },
    });
  });

  it('advances item from ready to delivered', async () => {
    prisma.orderItem.findFirst.mockResolvedValue({
      id: 'item-1',
      orderId: 'order-1',
      status: 'ready',
    });
    prisma.orderItem.update.mockResolvedValue({
      id: 'item-1',
      orderId: 'order-1',
      status: 'delivered',
    });

    const svc = makeService();
    const result = await svc.adminUpdateOrderItemStatus('order-1', 'item-1', 'delivered');

    expect(result.status).toBe('delivered');
  });

  it('cancels a pending item', async () => {
    prisma.orderItem.findFirst.mockResolvedValue({
      id: 'item-1',
      orderId: 'order-1',
      status: 'pending',
    });
    prisma.orderItem.update.mockResolvedValue({
      id: 'item-1',
      orderId: 'order-1',
      status: 'cancelled',
    });

    const svc = makeService();
    const result = await svc.adminUpdateOrderItemStatus('order-1', 'item-1', 'cancelled');

    expect(result.status).toBe('cancelled');
  });

  it('cancels a ready item', async () => {
    prisma.orderItem.findFirst.mockResolvedValue({
      id: 'item-1',
      orderId: 'order-1',
      status: 'ready',
    });
    prisma.orderItem.update.mockResolvedValue({
      id: 'item-1',
      orderId: 'order-1',
      status: 'cancelled',
    });

    const svc = makeService();
    const result = await svc.adminUpdateOrderItemStatus('order-1', 'item-1', 'cancelled');

    expect(result.status).toBe('cancelled');
  });

  it('rejects transition from delivered to ready (invalid)', async () => {
    prisma.orderItem.findFirst.mockResolvedValue({
      id: 'item-1',
      orderId: 'order-1',
      status: 'delivered',
    });

    const svc = makeService();
    await expect(
      svc.adminUpdateOrderItemStatus('order-1', 'item-1', 'ready'),
    ).rejects.toMatchObject({ code: 'ORD_003', status: 409 });
  });

  it('rejects transition from delivered to cancelled (terminal)', async () => {
    prisma.orderItem.findFirst.mockResolvedValue({
      id: 'item-1',
      orderId: 'order-1',
      status: 'delivered',
    });

    const svc = makeService();
    await expect(
      svc.adminUpdateOrderItemStatus('order-1', 'item-1', 'cancelled'),
    ).rejects.toMatchObject({ code: 'ORD_003', status: 409 });
  });

  it('rejects transition from cancelled to any state (terminal)', async () => {
    prisma.orderItem.findFirst.mockResolvedValue({
      id: 'item-1',
      orderId: 'order-1',
      status: 'cancelled',
    });

    const svc = makeService();
    await expect(
      svc.adminUpdateOrderItemStatus('order-1', 'item-1', 'pending'),
    ).rejects.toMatchObject({ code: 'ORD_003', status: 409 });
  });

  it('throws INF_001 when item does not belong to the given order', async () => {
    prisma.orderItem.findFirst.mockResolvedValue(null);

    const svc = makeService();
    await expect(
      svc.adminUpdateOrderItemStatus('order-1', 'item-wrong', 'ready'),
    ).rejects.toMatchObject({ code: 'INF_001', status: 404 });
  });

});
