import { v4 as uuidv4 } from 'uuid';
import { prisma } from '../lib/prisma.js';
import { EmailService } from './email.service.js';
import { adminLogService } from './admin-log.service.js';

const emailService = new EmailService();

/**
 * Normalize Prisma 6 model object for safe JSON serialization.
 * Prisma 6 proxies can cause Date fields to serialize as empty objects {},
 * and Decimal fields need explicit Number() conversion.
 */
function toJSONSafe(obj) {
  if (!obj || typeof obj !== 'object') return obj;

  // Prisma Decimal — convert to plain number
  if (obj.constructor?.name === 'Decimal' || typeof obj.toNumber === 'function') {
    return Number(obj);
  }

  if (Array.isArray(obj)) return obj.map(toJSONSafe);

  const out = {};
  for (const key of Object.keys(obj)) {
    const val = obj[key];
    if (val instanceof Date) {
      out[key] = val.toISOString();
    } else if (val && typeof val === 'object' && !Array.isArray(val)) {
      if (val.constructor?.name === 'Decimal' || typeof val.toNumber === 'function') {
        out[key] = Number(val);
      } else if (Object.keys(val).length > 0) {
        out[key] = toJSONSafe(val);
      } else {
        out[key] = val;
      }
    } else {
      out[key] = val;
    }
  }
  return out;
}

export class OrderService {
  async placeOrder(studentId, { paymentMethod }) {
    if (paymentMethod !== 'mercadopago' && paymentMethod !== 'cash' && paymentMethod !== 'transfer') {
      const err = new Error("invalid payment method, must be 'mercadopago', 'cash', or 'transfer'");
      err.code = 'PAY_002';
      err.status = 400;
      throw err;
    }

    return prisma.$transaction(async (tx) => {
      // 1. Lock and read cart
      const cart = await tx.cart.findFirst({
        where: { studentId },
        select: { id: true },
      });
      if (!cart) {
        const err = new Error('cart is empty');
        err.code = 'CART_002';
        err.status = 400;
        throw err;
      }

      // 2. Lock and read cart items
      const cartItems = await tx.cartItem.findMany({
        where: { cartId: cart.id },
        orderBy: { createdAt: 'asc' },
      });
      if (cartItems.length === 0) {
        const err = new Error('cart is empty');
        err.code = 'CART_002';
        err.status = 400;
        throw err;
      }

      // 3. Validate stock and compute total + delivery
      let total = 0;
      let maxDeliveryDays = 0;
      let hasDeliveryDays = false;

      for (const item of cartItems) {
        const booklet = await tx.booklet.findFirst({
          where: { id: item.bookletId },
          select: { stock: true, isActive: true },
        });
        if (!booklet || !booklet.isActive) {
          const err = new Error('insufficient stock for one or more items');
          err.code = 'CART_001';
          err.status = 400;
          throw err;
        }
        if (booklet.stock < item.quantity) {
          const err = new Error('insufficient stock for one or more items');
          err.code = 'CART_001';
          err.status = 400;
          throw err;
        }

        const lineTotal = Number(item.unitPrice) * item.quantity;
        total += lineTotal;

        if (item.deliveryDays && item.deliveryDays > maxDeliveryDays) {
          maxDeliveryDays = item.deliveryDays;
          hasDeliveryDays = true;
        }
      }

      // 4. Calculate delivery date
      let deliveryDate = null;
      if (hasDeliveryDays && maxDeliveryDays > 0) {
        deliveryDate = new Date(Date.now() + maxDeliveryDays * 24 * 60 * 60 * 1000);
      }

      // 5. Create order
      const order = await tx.order.create({
        data: {
          id: uuidv4(),
          studentId,
          total,
          status: 'pending',
          paymentMethod,
          paymentStatus: 'pending',
          deliveryDate,
        },
      });

      // 6. Create order items and decrement stock
      for (const item of cartItems) {
        await tx.orderItem.create({
          data: {
            id: uuidv4(),
            orderId: order.id,
            bookletId: item.bookletId,
            title: item.title,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            deliveryDays: item.deliveryDays,
          },
        });

        // Atomic stock decrement
        const result = await tx.booklet.updateMany({
          where: { id: item.bookletId, stock: { gte: item.quantity } },
          data: { stock: { decrement: item.quantity } },
        });
        if (result.count === 0) {
          const err = new Error('insufficient stock for one or more items');
          err.code = 'CART_001';
          err.status = 400;
          throw err;
        }
      }

      // 7. Clear cart items
      await tx.cartItem.deleteMany({ where: { cartId: cart.id } });

      // 8. Send email confirmation for offline payments only (cash/transfer)
      //    MercadoPago handles its own confirmation flow.
      if (paymentMethod === 'cash' || paymentMethod === 'transfer') {
        prisma.student.findUnique({
          where: { id: studentId },
          select: { email: true, name: true },
        }).then((studentForEmail) => {
          if (!studentForEmail?.email) return;
          emailService.sendOrderConfirmation(studentForEmail.email, {
            orderId: order.id,
            total,
            studentName: studentForEmail.name,
            paymentMethod,
            items: cartItems.map((i) => ({
              title: i.title,
              quantity: i.quantity,
              unitPrice: Number(i.unitPrice),
            })),
          }).catch((e) => console.error('[Email] order confirmation failed:', e.message));
        }).catch((e) => console.error('[Email] fetch student failed:', e.message));
      }

      return toJSONSafe(order);
    });
  }

  async listOrders(studentId, page = 1, limit = 10) {
    if (page < 1) page = 1;
    if (limit < 1 || limit > 50) limit = 10;

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where: { studentId },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.order.count({ where: { studentId } }),
    ]);

    if (orders.length === 0) return { orders: [], total: 0, page, limit };

    // Batch load items
    const orderIds = orders.map((o) => o.id);
    const items = await prisma.orderItem.findMany({
      where: { orderId: { in: orderIds } },
      orderBy: { createdAt: 'asc' },
    });

    const itemsMap = {};
    for (const item of items) {
      if (!itemsMap[item.orderId]) itemsMap[item.orderId] = [];
      itemsMap[item.orderId].push(item);
    }

    const result = orders.map((o) => ({
      order: toJSONSafe(o),
      items: itemsMap[o.id] ? itemsMap[o.id].map(toJSONSafe) : [],
    }));

    return { orders: result, total, page, limit };
  }

  async getOrder(studentId, orderId) {
    const order = await prisma.order.findUnique({ where: { id: orderId } });
    if (!order || order.studentId !== studentId) {
      const err = new Error('order not found');
      err.code = 'INF_001';
      err.status = 404;
      throw err;
    }

    const items = await prisma.orderItem.findMany({
      where: { orderId },
      orderBy: { createdAt: 'asc' },
    });

    return { order: toJSONSafe(order), items: items.map(toJSONSafe) };
  }

  async setPaymentReference(studentId, orderId, reference) {
    const order = await prisma.order.findUnique({ where: { id: orderId } });
    if (!order || order.studentId !== studentId) {
      const err = new Error('order not found');
      err.code = 'INF_001';
      err.status = 404;
      throw err;
    }
    if (order.paymentMethod !== 'transfer') {
      const err = new Error('payment method is not transfer');
      err.code = 'PAY_006';
      err.status = 400;
      throw err;
    }

    const updated = await prisma.order.update({
      where: { id: orderId },
      data: { notes: `Comprobante: ${reference}` },
    });
    return toJSONSafe(updated);
  }

  async cancelOrder(studentId, orderId) {
    const order = await prisma.order.findUnique({ where: { id: orderId } });
    if (!order || order.studentId !== studentId) {
      const err = new Error('order not found');
      err.code = 'INF_001';
      err.status = 404;
      throw err;
    }
    if (order.status !== 'pending' && order.status !== 'ready') {
      const err = new Error('order cannot be cancelled in its current status');
      err.code = 'ORD_002';
      err.status = 409;
      throw err;
    }

    const items = await prisma.orderItem.findMany({ where: { orderId } });

    // Check if all items are already delivered — nothing to cancel
    if (items.length > 0 && items.every((i) => i.status === 'delivered')) {
      const err = new Error('order cannot be cancelled in its current status');
      err.code = 'ORD_002';
      err.status = 409;
      throw err;
    }

    return prisma.$transaction(async (tx) => {
      // Re-check status under lock
      const current = await tx.order.findUnique({ where: { id: orderId }, select: { status: true } });
      if (current.status !== 'pending' && current.status !== 'ready') {
        const err = new Error('order cannot be cancelled in its current status');
        err.code = 'ORD_002';
        err.status = 409;
        throw err;
      }

      // Restore stock only for non-delivered items
      const nonDelivered = items.filter((i) => i.status !== 'delivered');
      for (const item of nonDelivered) {
        await tx.booklet.update({
          where: { id: item.bookletId },
          data: { stock: { increment: item.quantity } },
        });
      }

      // Only cancel non-delivered items
      const deliveredIds = items.filter((i) => i.status === 'delivered').map((i) => i.id);
      const cancelIds = nonDelivered.map((i) => i.id);
      if (cancelIds.length > 0) {
        await tx.orderItem.updateMany({
          where: { id: { in: cancelIds } },
          data: { status: 'cancelled' },
        });
      }

      // Update order status
      await tx.order.update({
        where: { id: orderId },
        data: { status: 'cancelled' },
      });

      return toJSONSafe({ ...order, status: 'cancelled' });
    });
  }

  async adminUpdateOrderItemStatus(orderId, itemId, newStatus) {
    const VALID_TRANSITIONS = {
      pending:    ['ready', 'cancelled'],
      ready:      ['delivered', 'cancelled'],
      delivered:  [],
      cancelled:  [],
    };

    const item = await prisma.orderItem.findFirst({
      where: { id: itemId, orderId },
    });
    if (!item) {
      const err = new Error('order item not found');
      err.code = 'INF_001';
      err.status = 404;
      throw err;
    }

    const allowed = VALID_TRANSITIONS[item.status];
    if (!allowed || !allowed.includes(newStatus)) {
      const err = new Error(`cannot transition from '${item.status}' to '${newStatus}'`);
      err.code = 'ORD_003';
      err.status = 409;
      throw err;
    }

    const result = await prisma.orderItem.update({
      where: { id: itemId },
      data: { status: newStatus },
    });
    return toJSONSafe(result);
  }

  // Admin
  async adminListOrders(status, page = 1, limit = 10) {
    if (page < 1) page = 1;
    if (limit < 1 || limit > 50) limit = 10;

    const where = status ? { status } : {};

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.order.count({ where }),
    ]);

    return { orders: orders.map(toJSONSafe), total, page, limit };
  }

  async adminListOrdersWithDetails(status, page = 1, limit = 10) {
    if (page < 1) page = 1;
    if (limit < 1 || limit > 50) limit = 10;

    const where = status ? { status } : {};

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          student: {
            include: {
              course: {
                include: {
                  school: true,
                },
              },
            },
          },
        },
      }),
      prisma.order.count({ where }),
    ]);

    if (orders.length === 0) return { orders: [], studentNames: {}, total: 0, page, limit };

    const orderIds = orders.map((o) => o.id);
    const items = await prisma.orderItem.findMany({
      where: { orderId: { in: orderIds } },
      orderBy: { createdAt: 'asc' },
      include: {
        booklet: {
          include: {
            school: true,
          },
        },
      },
    });

    const itemsMap = {};
    for (const item of items) {
      if (!itemsMap[item.orderId]) itemsMap[item.orderId] = [];
      itemsMap[item.orderId].push(item);
    }

    const studentNames = {};
    const result = orders.map((o) => {
      studentNames[o.student.id] = o.student.name;
      const orderItems = itemsMap[o.id] || [];

      // Determine school: prefer student's course school, fall back to booklet school
      const schoolFromStudent = o.student?.course?.school || null;
      const schoolFromItems = orderItems.find(i => i.booklet?.school)?.booklet?.school || null;

      return {
        order: toJSONSafe(o),
        items: orderItems.map(toJSONSafe),
        school: schoolFromStudent || schoolFromItems,
      };
    });

    return { orders: result, studentNames, total, page, limit };
  }

  async getOrderByAdmin(orderId) {
    const order = await prisma.order.findUnique({ where: { id: orderId } });
    if (!order) {
      const err = new Error('order not found');
      err.code = 'INF_001';
      err.status = 404;
      throw err;
    }

    const items = await prisma.orderItem.findMany({
      where: { orderId },
      orderBy: { createdAt: 'asc' },
    });

    return { order: toJSONSafe(order), items: items.map(toJSONSafe) };
  }

  async adminUpdateOrderStatus(orderId, newStatus, adminId = null) {
    const VALID_TRANSITIONS = {
      pending:    ['ready', 'cancelled'],
      ready:      ['delivered', 'cancelled'],
      delivered:  [],
      cancelled:  [],
    };

    const order = await prisma.order.findUnique({ where: { id: orderId }, select: { status: true, id: true } });
    if (!order) {
      const err = new Error('order not found');
      err.code = 'INF_001';
      err.status = 404;
      throw err;
    }

    const oldStatus = order.status;

    const allowed = VALID_TRANSITIONS[oldStatus];
    if (!allowed || !allowed.includes(newStatus)) {
      const err = new Error(`cannot transition from '${oldStatus}' to '${newStatus}'`);
      err.code = 'ORD_003';
      err.status = 409;
      throw err;
    }

    const data = { status: newStatus };
    if (newStatus === 'delivered') {
      data.deliveredAt = new Date();
    }
    const result = await prisma.order.updateMany({
      where: { id: orderId },
      data,
    });
    if (result.count === 0) {
      const err = new Error('order not found');
      err.code = 'INF_001';
      err.status = 404;
      throw err;
    }

    if (adminId) {
      adminLogService.log(adminId, 'update', 'order', orderId, { from: oldStatus, to: newStatus }).catch(
        (e) => console.error('[Audit] order status log failed:', e.message)
      );
    }

    // Fire-and-forget email notification on status transitions
    if (newStatus === 'ready' || newStatus === 'delivered' || newStatus === 'cancelled') {
      prisma.order.findUnique({
        where: { id: orderId },
        include: { student: { select: { email: true, name: true } } },
      }).then((fullOrder) => {
        if (!fullOrder?.student?.email) return;
        const { email, name } = fullOrder.student;
        if (newStatus === 'ready') {
          emailService.sendOrderReady(email, { orderId, studentName: name })
            .catch((e) => console.error('[Email] order ready failed:', e.message));
        } else if (newStatus === 'delivered') {
          emailService.sendOrderDelivered(email, { orderId, studentName: name })
            .catch((e) => console.error('[Email] order delivered failed:', e.message));
        }
      }).catch((e) => console.error('[Email] fetch order for notification failed:', e.message));
    }
  }

  async adminSearchOrderByID(idPrefix) {
    const pattern = `${idPrefix}%`;
    const order = await prisma.order.findFirst({
      where: { id: { startsWith: idPrefix } },
      include: {
        student: {
          include: {
            course: {
              include: {
                school: true,
              },
            },
          },
        },
      },
    });
    if (!order) return null;

    const items = await prisma.orderItem.findMany({
      where: { orderId: order.id },
      orderBy: { createdAt: 'asc' },
    });

    return {
      order: toJSONSafe(order),
      items: items.map(toJSONSafe),
      studentName: order.student.name,
    };
  }

  async adminSearchOrdersByStudentName(name) {
    const pattern = `%${name}%`;
    const orders = await prisma.order.findMany({
      where: { student: { name: { contains: name, mode: 'insensitive' } } },
      orderBy: { createdAt: 'desc' },
      include: {
        student: {
          include: {
            course: {
              include: {
                school: true,
              },
            },
          },
        },
      },
    });

    const orderIds = orders.map((o) => o.id);
    const items = await prisma.orderItem.findMany({
      where: { orderId: { in: orderIds } },
      orderBy: { createdAt: 'asc' },
    });

    const itemsMap = {};
    for (const item of items) {
      if (!itemsMap[item.orderId]) itemsMap[item.orderId] = [];
      itemsMap[item.orderId].push(item);
    }

    const studentNames = {};
    const result = orders.map((o) => {
      studentNames[o.student.id] = o.student.name;
      return { order: toJSONSafe(o), items: (itemsMap[o.id] || []).map(toJSONSafe) };
    });

    return { orders: result, studentNames, itemsMap };
  }

  async adminSearchOrdersByBookletTitle(title) {
    const orders = await prisma.orderItem.findMany({
      where: { title: { contains: title, mode: 'insensitive' } },
      include: {
        order: {
          include: {
            student: {
              include: {
                course: {
                  include: {
                    school: true,
                  },
                },
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return orders.map((item) => ({
      studentName: item.order.student.name,
      studentId: item.order.student.id,
      orderId: item.order.id,
      bookletTitle: item.title,
      quantity: item.quantity,
      orderStatus: item.order.status,
      createdAt: item.order.createdAt,
    }));
  }
}
