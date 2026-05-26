import { v4 as uuidv4 } from 'uuid';
import { prisma } from '../lib/prisma.js';
import { config } from '../config.js';

export class PaymentService {
  constructor(gateway) {
    this.gateway = gateway;
  }

  async initiatePayment(studentId, orderId, method) {
    const order = await prisma.order.findUnique({ where: { id: orderId } });
    if (!order) {
      const err = new Error('order not found');
      err.code = 'INF_001';
      err.status = 404;
      throw err;
    }
    if (order.studentId !== studentId) {
      const err = new Error('order not found');
      err.code = 'INF_001';
      err.status = 404;
      throw err;
    }
    if (order.paymentMethod !== method) {
      const err = new Error('invalid payment method for this order');
      err.code = 'PAY_002';
      err.status = 400;
      throw err;
    }
    if (order.paymentStatus === 'paid') {
      const err = new Error('order already paid');
      err.code = 'PAY_003';
      err.status = 400;
      throw err;
    }

    // Check existing payment record
    const existingPayment = await prisma.payment.findUnique({ where: { orderId } });
    if (existingPayment && existingPayment.status === 'approved') {
      const err = new Error('order already paid');
      err.code = 'PAY_003';
      err.status = 400;
      throw err;
    }
    if (existingPayment && existingPayment.status !== 'pending') {
      const err = new Error('order already paid');
      err.code = 'PAY_003';
      err.status = 400;
      throw err;
    }

    if (method === 'mercadopago') {
      return this.initiateMP(order);
    }
    if (method === 'cash') {
      return this.initiateCash(order);
    }
    
    const err = new Error('invalid payment method');
    err.code = 'PAY_002';
    err.status = 400;
    throw err;
  }

  async initiateMP(order) {
    const items = await prisma.orderItem.findMany({ where: { orderId: order.id } });

    const mpItems = items.map((item) => ({
      title: item.title,
      quantity: item.quantity,
      unitPrice: Number(item.unitPrice) / 100,
      currencyId: 'ARS',
    }));

    const pref = await this.gateway.createPreference(order.id, mpItems, {
      success: `${config.frontendUrl}/orders`,
      failure: `${config.frontendUrl}/orders`,
      pending: `${config.frontendUrl}/orders`,
    });

    const payment = await prisma.payment.create({
      data: {
        id: uuidv4(),
        orderId: order.id,
        method: 'mercadopago',
        status: 'pending',
        amount: order.total,
        externalReference: order.id,
        mpPaymentId: pref.id,
      },
    });

    await prisma.order.update({
      where: { id: order.id },
      data: { mpPreferenceId: pref.id },
    });

    return { payment, paymentUrl: pref.initPoint };
  }

  async initiateCash(order) {
    const payment = await prisma.payment.create({
      data: {
        id: uuidv4(),
        orderId: order.id,
        method: 'cash',
        status: 'pending',
        amount: order.total,
        externalReference: order.id,
      },
    });

    return { payment };
  }

  async handleMPWebhook(rawBody) {
    let payload;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      throw new Error('parse webhook payload failed');
    }

    if (!payload.data || !payload.data.id) {
      throw new Error('missing data.id in webhook payload');
    }

    const notificationId = payload.id ? String(payload.id) : `${payload.data.id}-${payload.action}`;
    if (!notificationId || notificationId === '0') {
      throw new Error('invalid notification ID');
    }

    // Upsert event for idempotency
    const existing = await prisma.paymentEvent.findUnique({
      where: { eventId: notificationId },
    });

    if (!existing) {
      await prisma.paymentEvent.create({
        data: {
          id: uuidv4(),
          eventId: notificationId,
          topic: payload.type,
          action: payload.action,
          mpPaymentId: payload.data.id,
          rawBody: rawBody,
          processed: false,
        },
      });
    } else {
      // Already processed — idempotent
      return;
    }

    // Only process "payment" topic events
    if (payload.type !== 'payment') return;

    // Query MP for payment status
    const mpPaymentId = parseInt(payload.data.id, 10);
    if (isNaN(mpPaymentId)) {
      throw new Error(`parse mp payment id "${payload.data.id}" failed`);
    }

    const mpInfo = await this.gateway.getPaymentInfo(mpPaymentId);
    if (!mpInfo.externalReference) return;

    const extRef = mpInfo.externalReference;

    // ── NEW FLOW: PendingCheckout (no order created yet) ────────────
    const pendingCheckout = await prisma.pendingCheckout.findUnique({
      where: { id: extRef },
    });

    if (pendingCheckout) {
      return this._handlePendingCheckoutWebhook(pendingCheckout, mpInfo);
    }

    // ── OLD FLOW: Existing order with a Payment record ──────────────
    const payment = await prisma.payment.findFirst({
      where: { externalReference: extRef },
    });
    if (!payment) return;

    // Map MP status
    let paymentStatus;
    let orderStatus;
    let paidAt = null;

    switch (mpInfo.status) {
      case 'approved':
        paymentStatus = 'approved';
        orderStatus = 'pending';
        paidAt = new Date();
        break;
      case 'rejected':
      case 'cancelled':
        paymentStatus = 'rejected';
        orderStatus = 'cancelled';
        // Restore stock when payment fails
        const failedItems = await prisma.orderItem.findMany({
          where: { orderId: payment.orderId },
        });
        for (const item of failedItems) {
          await prisma.booklet.update({
            where: { id: item.bookletId },
            data: { stock: { increment: item.quantity } },
          });
        }
        break;
      case 'refunded':
        paymentStatus = 'refunded';
        orderStatus = 'pending';
        break;
      default:
        return; // "pending" or "in_process" — leave as-is
    }

    // Map to order payment_status enum
    const orderPaymentStatus = this.mapMpPaymentStatus(paymentStatus);

    // Update payment
    await prisma.payment.update({
      where: { id: payment.id },
      data: { status: paymentStatus, paidAt },
    });

    // Update order
    if (payment.orderId) {
      await prisma.order.update({
        where: { id: payment.orderId },
        data: { paymentStatus: orderPaymentStatus, status: orderStatus },
      });
    }
  }

  // ── PendingCheckout webhook handling ─────────────────────────────────

  async _handlePendingCheckoutWebhook(pendingCheckout, mpInfo) {
    switch (mpInfo.status) {
      case 'approved':
        return this._completeCheckout(pendingCheckout);
      case 'rejected':
      case 'cancelled':
      case 'refunded':
        await prisma.pendingCheckout.update({
          where: { id: pendingCheckout.id },
          data: { status: 'failed' },
        });
        return;
      default:
        return; // "pending" or "in_process" — leave as-is
    }
  }

  async _completeCheckout(pendingCheckout) {
    const items = pendingCheckout.items;
    const studentId = pendingCheckout.studentId;
    const orderId = uuidv4();

    // 1. Re-validate stock BEFORE creating anything (outside transaction)
    for (const item of items) {
      const booklet = await prisma.booklet.findFirst({
        where: { id: item.bookletId },
        select: { stock: true, isActive: true },
      });
      if (!booklet || !booklet.isActive || booklet.stock < item.quantity) {
        await prisma.pendingCheckout.update({
          where: { id: pendingCheckout.id },
          data: { status: 'failed' },
        });
        console.error(
          `[MP Checkout] Stock shortage for booklet ${item.bookletId} ` +
          `(need ${item.quantity}, have ${booklet?.stock ?? 0}). ` +
          `PendingCheckout ${pendingCheckout.id} marked as failed. ` +
          `User was charged but no order created — needs admin refund.`
        );
        return;
      }
    }

    await prisma.$transaction(async (tx) => {
      // 2. Create order
      await tx.order.create({
        data: {
          id: orderId,
          studentId,
          total: pendingCheckout.total,
          status: 'pending',
          paymentMethod: 'mercadopago',
          paymentStatus: 'paid',
        },
      });

      // 3. Create order items + decrement stock + compute delivery
      let maxDeliveryDays = 0;

      for (const item of items) {
        await tx.orderItem.create({
          data: {
            id: uuidv4(),
            orderId,
            bookletId: item.bookletId,
            title: item.title,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            deliveryDays: item.deliveryDays,
          },
        });

        await tx.booklet.update({
          where: { id: item.bookletId },
          data: { stock: { decrement: item.quantity } },
        });

        if (item.deliveryDays && item.deliveryDays > maxDeliveryDays) {
          maxDeliveryDays = item.deliveryDays;
        }
      }

      // 4. Set delivery date
      if (maxDeliveryDays > 0) {
        await tx.order.update({
          where: { id: orderId },
          data: {
            deliveryDate: new Date(Date.now() + maxDeliveryDays * 24 * 60 * 60 * 1000),
          },
        });
      }

      // 5. Create payment record
      await tx.payment.create({
        data: {
          id: uuidv4(),
          orderId,
          method: 'mercadopago',
          status: 'approved',
          amount: pendingCheckout.total,
          externalReference: pendingCheckout.id,
          mpPaymentId: pendingCheckout.mpPreferenceId,
          paidAt: new Date(),
        },
      });

      // 6. Clear the student's cart
      const cart = await tx.cart.findFirst({ where: { studentId } });
      if (cart) {
        await tx.cartItem.deleteMany({ where: { cartId: cart.id } });
      }

      // 7. Mark pending checkout as completed
      await tx.pendingCheckout.update({
        where: { id: pendingCheckout.id },
        data: { status: 'completed' },
      });
    });
  }

  mapMpPaymentStatus(status) {
    switch (status) {
      case 'approved': return 'paid';
      case 'rejected': return 'failed';
      case 'refunded': return 'refunded';
      default: return 'pending';
    }
  }

  async confirmCashPayment(orderId) {
    const payment = await prisma.payment.findUnique({ where: { orderId } });
    if (!payment) {
      const err = new Error('order or payment not found');
      err.code = 'INF_001';
      err.status = 404;
      throw err;
    }
    if (payment.method !== 'cash') {
      const err = new Error('payment method is not cash');
      err.code = 'PAY_006';
      err.status = 400;
      throw err;
    }
    if (payment.status !== 'pending') {
      const err = new Error('payment already processed');
      err.code = 'PAY_003';
      err.status = 400;
      throw err;
    }

    const now = new Date();
    await prisma.payment.update({
      where: { id: payment.id },
      data: { status: 'approved', paidAt: now },
    });

    await prisma.order.update({
      where: { id: orderId },
      data: { paymentStatus: 'paid', status: 'pending' },
    });
  }
}
