import { v4 as uuidv4 } from 'uuid';
import { prisma } from '../lib/prisma.js';

export class OrderService {
  async placeOrder(studentId, { paymentMethod }) {
    if (paymentMethod !== 'mercadopago' && paymentMethod !== 'cash') {
      const err = new Error("invalid payment method, must be 'mercadopago' or 'cash'");
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

      return order;
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
      order: o,
      items: itemsMap[o.id] || [],
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

    return { order, items };
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

    return prisma.$transaction(async (tx) => {
      // Re-check status under lock
      const current = await tx.order.findUnique({ where: { id: orderId }, select: { status: true } });
      if (current.status !== 'pending' && current.status !== 'ready') {
        const err = new Error('order cannot be cancelled in its current status');
        err.code = 'ORD_002';
        err.status = 409;
        throw err;
      }

      // Restore stock
      for (const item of items) {
        await tx.booklet.update({
          where: { id: item.bookletId },
          data: { stock: { increment: item.quantity } },
        });
      }

      // Update order status
      await tx.order.update({
        where: { id: orderId },
        data: { status: 'cancelled' },
      });

      return { ...order, status: 'cancelled' };
    });
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

    return { orders, total, page, limit };
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
    });

    const itemsMap = {};
    for (const item of items) {
      if (!itemsMap[item.orderId]) itemsMap[item.orderId] = [];
      itemsMap[item.orderId].push(item);
    }

    const studentNames = {};
    const result = orders.map((o) => {
      studentNames[o.student.id] = o.student.name;
      return {
        order: o,
        items: itemsMap[o.id] || [],
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

    return { order, items };
  }

  async adminUpdateOrderStatus(orderId, status) {
    const result = await prisma.order.updateMany({
      where: { id: orderId },
      data: { status },
    });
    if (result.count === 0) {
      const err = new Error('order not found');
      err.code = 'INF_001';
      err.status = 404;
      throw err;
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
      order,
      items,
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
      return { order: o, items: itemsMap[o.id] || [] };
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
