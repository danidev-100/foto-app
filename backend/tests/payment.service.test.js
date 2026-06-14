/**
 * PaymentService unit tests — mock Prisma + gateway.
 *
 * Tests:
 *   - handleMPWebhook processes payment.approved (old flow)
 *   - handleMPWebhook creates order from pending checkout (new flow)
 *   - handleMPWebhook is idempotent (same event twice)
 *   - confirmCashPayment marks payment as approved
 *   - confirmCashPayment rejects non-cash method
 *   - confirmTransferPayment marks payment as approved
 *   - confirmTransferPayment creates payment record if missing
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock uuid to return predictable IDs
vi.mock('uuid', () => ({
  v4: vi.fn(() => 'mock-uuid-123'),
}));

// Mock email.service to prevent SMTP init
vi.mock('../src/services/email.service.js', () => ({
  EmailService: class MockEmailService {
    constructor() {
      this.sendPaymentConfirmed = vi.fn().mockResolvedValue({ messageId: 'mock' });
      this.sendEmail = vi.fn().mockResolvedValue({ messageId: 'mock' });
    }
  },
}));

// Mock admin-log.service
vi.mock('../src/services/admin-log.service.js', () => ({
  adminLogService: {
    log: vi.fn().mockResolvedValue({ id: 'log-1' }),
    list: vi.fn(),
    getStats: vi.fn(),
  },
}));

// Mock prisma
vi.mock('../src/lib/prisma.js', () => ({
  prisma: {
    paymentEvent: { findUnique: vi.fn(), create: vi.fn() },
    pendingCheckout: { findUnique: vi.fn(), update: vi.fn() },
    payment: { findUnique: vi.fn(), findFirst: vi.fn(), update: vi.fn(), create: vi.fn() },
    order: { findUnique: vi.fn(), update: vi.fn(), create: vi.fn() },
    orderItem: { findMany: vi.fn(), create: vi.fn() },
    booklet: { findFirst: vi.fn(), update: vi.fn() },
    cart: { findFirst: vi.fn() },
    cartItem: { deleteMany: vi.fn() },
    $transaction: vi.fn(),
  },
}));

const { prisma } = await import('../src/lib/prisma.js');
const { PaymentService } = await import('../src/services/payment.service.js');

function makeService(gateway) {
  const gw = gateway || { createPreference: vi.fn(), getPaymentInfo: vi.fn() };
  return new PaymentService(gw);
}

beforeEach(() => {
  vi.clearAllMocks();
});

/* ─── handleMPWebhook ──────────────────────────────────── */

describe('handleMPWebhook', () => {
  const gateway = { getPaymentInfo: vi.fn() };

  it('processes payment.approved (old flow - existing Payment record)', async () => {
    const payload = JSON.stringify({
      id: 'evt-1', type: 'payment', action: 'payment.updated',
      data: { id: '123' },
    });

    // First time — event not found
    prisma.paymentEvent.findUnique.mockResolvedValue(null);
    prisma.paymentEvent.create.mockResolvedValue({ id: 'pe-1' });
    gateway.getPaymentInfo.mockResolvedValue({
      status: 'approved',
      externalReference: 'order-1',
    });
    // Not a pending checkout
    prisma.pendingCheckout.findUnique.mockResolvedValue(null);
    // Found existing Payment record
    prisma.payment.findFirst.mockResolvedValue({
      id: 'pay-1', orderId: 'order-1', status: 'pending', amount: 3000,
    });
    prisma.payment.update.mockResolvedValue({ id: 'pay-1', status: 'approved' });
    prisma.order.update.mockResolvedValue({ id: 'order-1', paymentStatus: 'paid' });

    const svc = makeService(gateway);
    await svc.handleMPWebhook(payload);

    expect(prisma.paymentEvent.create).toHaveBeenCalled();
    expect(gateway.getPaymentInfo).toHaveBeenCalledWith(123);
    expect(prisma.payment.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'approved' }) }),
    );
    expect(prisma.order.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'order-1' },
        data: expect.objectContaining({ paymentStatus: 'paid' }),
      }),
    );
  });

  it('handles rejected payment and restores stock', async () => {
    const payload = JSON.stringify({
      id: 'evt-2', type: 'payment', action: 'payment.updated',
      data: { id: '456' },
    });

    prisma.paymentEvent.findUnique.mockResolvedValue(null);
    prisma.paymentEvent.create.mockResolvedValue({ id: 'pe-2' });
    gateway.getPaymentInfo.mockResolvedValue({
      status: 'rejected',
      externalReference: 'order-2',
    });
    prisma.pendingCheckout.findUnique.mockResolvedValue(null);
    prisma.payment.findFirst.mockResolvedValue({
      id: 'pay-2', orderId: 'order-2', status: 'pending',
    });
    prisma.orderItem.findMany.mockResolvedValue([
      { id: 'item-1', bookletId: 'b1', quantity: 2 },
    ]);
    prisma.booklet.update.mockResolvedValue({});
    prisma.payment.update.mockResolvedValue({});
    prisma.order.update.mockResolvedValue({});

    const svc = makeService(gateway);
    await svc.handleMPWebhook(payload);

    // Stock should be restored for rejected payment
    expect(prisma.booklet.update).toHaveBeenCalledWith({
      where: { id: 'b1' },
      data: { stock: { increment: 2 } },
    });
    expect(prisma.payment.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'rejected' }) }),
    );
    expect(prisma.order.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'cancelled' }) }),
    );
  });

  it('is idempotent — same event twice does not process again', async () => {
    const payload = JSON.stringify({
      id: 'evt-1', type: 'payment', action: 'payment.updated',
      data: { id: 'mp-123' },
    });

    // Second time — event already exists (idempotent)
    prisma.paymentEvent.findUnique.mockResolvedValue({ id: 'pe-1', eventId: 'evt-1' });

    const svc = makeService(gateway);
    await svc.handleMPWebhook(payload);

    // Should NOT create another event or call gateway
    expect(prisma.paymentEvent.create).not.toHaveBeenCalled();
    expect(gateway.getPaymentInfo).not.toHaveBeenCalled();
  });

  it('processes pending checkout (new flow — creates order)', async () => {
    const payload = JSON.stringify({
      id: 'evt-3', type: 'payment', action: 'payment.updated',
      data: { id: '789' },
    });

    prisma.paymentEvent.findUnique.mockResolvedValue(null);
    prisma.paymentEvent.create.mockResolvedValue({ id: 'pe-3' });
    gateway.getPaymentInfo.mockResolvedValue({
      status: 'approved',
      externalReference: 'pc-1',
    });

    // Found pending checkout
    const pendingCheckout = {
      id: 'pc-1',
      studentId: 'student-1',
      total: 3000,
      items: [
        { bookletId: 'b1', title: 'Test Booklet', quantity: 2, unitPrice: 1500, deliveryDays: 0 },
      ],
      mpPreferenceId: 'mp-pref-1',
    };
    prisma.pendingCheckout.findUnique.mockResolvedValue(pendingCheckout);

    // Stock validation
    prisma.booklet.findFirst.mockResolvedValue({ stock: 10, isActive: true });

    // Transaction
    const mockTx = {
      order: { create: vi.fn(), update: vi.fn() },
      orderItem: { create: vi.fn() },
      booklet: { update: vi.fn() },
      payment: { create: vi.fn() },
      cart: { findFirst: vi.fn() },
      cartItem: { deleteMany: vi.fn() },
      pendingCheckout: { update: vi.fn() },
    };
    prisma.$transaction.mockImplementation(async (cb) => cb(mockTx));
    mockTx.cart.findFirst.mockResolvedValue({ id: 'cart-1' });

    const svc = makeService(gateway);
    await svc.handleMPWebhook(payload);

    // Verify order was created
    expect(mockTx.order.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          studentId: 'student-1',
          total: 3000,
          paymentStatus: 'paid',
        }),
      }),
    );

    // Verify payment record created
    expect(mockTx.payment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          orderId: expect.any(String),
          method: 'mercadopago',
          status: 'approved',
        }),
      }),
    );

    // Verify pending checkout marked as completed
    expect(mockTx.pendingCheckout.update).toHaveBeenCalledWith({
      where: { id: 'pc-1' },
      data: { status: 'completed' },
    });

    // Verify cart cleared
    expect(mockTx.cartItem.deleteMany).toHaveBeenCalled();
  });

  it('handles pending checkout with insufficient stock gracefully', async () => {
    const payload = JSON.stringify({
      id: 'evt-4', type: 'payment', action: 'payment.updated',
      data: { id: '101' },
    });

    prisma.paymentEvent.findUnique.mockResolvedValue(null);
    prisma.paymentEvent.create.mockResolvedValue({ id: 'pe-4' });
    gateway.getPaymentInfo.mockResolvedValue({
      status: 'approved',
      externalReference: 'pc-2',
    });

    prisma.pendingCheckout.findUnique.mockResolvedValue({
      id: 'pc-2', studentId: 'student-1', total: 1500,
      items: [{ bookletId: 'b1', title: 'Out of Stock', quantity: 5, unitPrice: 300 }],
    });

    // Stock insufficient
    prisma.booklet.findFirst.mockResolvedValue({ stock: 0, isActive: true });
    prisma.pendingCheckout.update.mockResolvedValue({});

    const svc = makeService(gateway);
    await svc.handleMPWebhook(payload);

    // Should mark as failed, not create transaction
    expect(prisma.pendingCheckout.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: 'failed' } }),
    );
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});

/* ─── confirmCashPayment ───────────────────────────────── */

describe('confirmCashPayment', () => {
  it('marks cash payment as approved', async () => {
    const orderId = 'order-1';
    prisma.payment.findUnique.mockResolvedValue({
      id: 'pay-1', orderId, method: 'cash', status: 'pending', amount: 2000,
    });
    prisma.payment.update.mockResolvedValue({ id: 'pay-1', status: 'approved' });
    prisma.order.update.mockResolvedValue({ id: orderId, paymentStatus: 'paid' });

    // Mock prisma.order.findUnique for the fire-and-forget email
    prisma.order.findUnique.mockResolvedValue({
      id: orderId,
      student: { email: 'student@test.com', name: 'Student' },
    });

    const svc = makeService();
    await svc.confirmCashPayment(orderId, 'admin-1');

    expect(prisma.payment.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'approved' }) }),
    );
    expect(prisma.order.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ paymentStatus: 'paid' }) }),
    );
  });

  it('returns error when payment not found', async () => {
    prisma.payment.findUnique.mockResolvedValue(null);

    const svc = makeService();
    await expect(
      svc.confirmCashPayment('nonexistent'),
    ).rejects.toMatchObject({ code: 'INF_001', status: 404 });
  });

  it('returns error when payment method is not cash', async () => {
    prisma.payment.findUnique.mockResolvedValue({
      id: 'pay-2', orderId: 'order-2', method: 'mercadopago', status: 'pending',
    });

    const svc = makeService();
    await expect(
      svc.confirmCashPayment('order-2'),
    ).rejects.toMatchObject({ code: 'PAY_006', status: 400 });
  });

  it('returns error when payment already processed', async () => {
    prisma.payment.findUnique.mockResolvedValue({
      id: 'pay-3', orderId: 'order-3', method: 'cash', status: 'approved',
    });

    const svc = makeService();
    await expect(
      svc.confirmCashPayment('order-3'),
    ).rejects.toMatchObject({ code: 'PAY_003', status: 400 });
  });
});

/* ─── confirmTransferPayment ──────────────────────────── */

describe('confirmTransferPayment', () => {
  it('marks existing transfer payment as approved', async () => {
    const orderId = 'order-1';
    prisma.order.findUnique.mockResolvedValue({
      id: orderId, studentId: 's1', total: 5000, paymentMethod: 'transfer', paymentStatus: 'pending',
    });
    prisma.payment.findUnique.mockResolvedValue({
      id: 'pay-1', orderId, method: 'transfer', status: 'pending', amount: 5000,
    });
    prisma.payment.update.mockResolvedValue({ id: 'pay-1', status: 'approved' });
    prisma.order.update.mockResolvedValue({ id: orderId, paymentStatus: 'paid' });

    // Mock for fire-and-forget email
    prisma.order.findUnique.mockResolvedValue({
      id: orderId,
      student: { email: 'student@test.com', name: 'Student' },
    });

    const svc = makeService();
    await svc.confirmTransferPayment(orderId, 'admin-1');

    expect(prisma.payment.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'approved' }) }),
    );
    expect(prisma.order.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ paymentStatus: 'paid' }) }),
    );
  });

  it('creates payment record if none exists', async () => {
    const orderId = 'order-2';
    prisma.order.findUnique.mockResolvedValue({
      id: orderId, studentId: 's2', total: 3000, paymentMethod: 'transfer',
      paymentStatus: 'pending', status: 'pending',
    });
    prisma.payment.findUnique.mockResolvedValue(null); // no payment record
    prisma.payment.create.mockResolvedValue({
      id: 'pay-new', orderId, method: 'transfer', status: 'approved',
    });
    prisma.order.update.mockResolvedValue({ id: orderId, paymentStatus: 'paid' });

    // Mock for fire-and-forget email
    prisma.order.findUnique.mockResolvedValue({
      id: orderId,
      student: { email: 'student@test.com', name: 'Student' },
    });

    const svc = makeService();
    await svc.confirmTransferPayment(orderId, 'admin-1');

    expect(prisma.payment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          orderId, method: 'transfer', status: 'approved',
        }),
      }),
    );
  });

  it('returns error when order not found', async () => {
    prisma.order.findUnique.mockResolvedValue(null);

    const svc = makeService();
    await expect(
      svc.confirmTransferPayment('nonexistent'),
    ).rejects.toMatchObject({ code: 'INF_001', status: 404 });
  });

  it('returns error when payment already approved', async () => {
    const orderId = 'order-3';
    prisma.order.findUnique.mockResolvedValue({
      id: orderId, studentId: 's1', total: 5000,
    });
    prisma.payment.findUnique.mockResolvedValue({
      id: 'pay-3', orderId, method: 'transfer', status: 'approved',
    });

    const svc = makeService();
    await expect(
      svc.confirmTransferPayment(orderId),
    ).rejects.toMatchObject({ code: 'PAY_003', status: 400 });
  });

  it('returns error when payment method is not transfer', async () => {
    const orderId = 'order-4';
    prisma.order.findUnique.mockResolvedValue({
      id: orderId, studentId: 's1', total: 5000,
    });
    prisma.payment.findUnique.mockResolvedValue({
      id: 'pay-4', orderId, method: 'cash', status: 'pending',
    });

    const svc = makeService();
    await expect(
      svc.confirmTransferPayment(orderId),
    ).rejects.toMatchObject({ code: 'PAY_006', status: 400 });
  });
});
