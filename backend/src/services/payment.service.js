import { v4 as uuidv4 } from 'uuid';
import { prisma } from '../lib/prisma.js';

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

    const baseUrl = process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : 'http://localhost:3000';

    const pref = await this.gateway.createPreference(order.id, mpItems, {
      success: `${baseUrl}/orders`,
      failure: `${baseUrl}/orders`,
      pending: `${baseUrl}/orders`,
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

    // Find payment record by external_reference (order_id)
    if (!mpInfo.externalReference) return;

    const payment = await prisma.payment.findFirst({
      where: { externalReference: mpInfo.externalReference },
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
        orderStatus = 'pending';
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
