import { v4 as uuidv4 } from 'uuid';
import { prisma } from '../lib/prisma.js';

export class CartService {
  async addItem(studentId, { bookletId, quantity }) {
    if (!bookletId || quantity <= 0) {
      const err = new Error('booklet_id and a positive quantity are required');
      err.code = 'AUTH_004';
      err.status = 400;
      throw err;
    }

    const booklet = await prisma.booklet.findUnique({ where: { id: bookletId } });
    if (!booklet) {
      const err = new Error('booklet not found');
      err.code = 'CAT_003';
      err.status = 404;
      throw err;
    }
    if (booklet.stock < quantity) {
      const err = new Error('insufficient stock');
      err.code = 'CART_001';
      err.status = 400;
      throw err;
    }

    // Get or create cart
    let cart = await prisma.cart.findUnique({ where: { studentId } });
    if (!cart) {
      cart = await prisma.cart.create({
        data: { id: uuidv4(), studentId },
      });
    }

    // Check if item already exists
    const existingItem = await prisma.cartItem.findUnique({
      where: { cartId_bookletId: { cartId: cart.id, bookletId } },
    });

    if (existingItem) {
      const newQty = existingItem.quantity + quantity;
      if (booklet.stock < newQty) {
        const err = new Error('insufficient stock');
        err.code = 'CART_001';
        err.status = 400;
        throw err;
      }
      await prisma.cartItem.update({
        where: { cartId_bookletId: { cartId: cart.id, bookletId } },
        data: { quantity: newQty },
      });
    } else {
      await prisma.cartItem.create({
        data: {
          id: uuidv4(),
          cartId: cart.id,
          bookletId,
          quantity,
          unitPrice: booklet.currentPrice,
          title: booklet.title,
        },
      });
    }

    return this.buildCartResponse(cart.id, studentId);
  }

  async updateItem(studentId, bookletId, { quantity }) {
    if (quantity <= 0) {
      const err = new Error('quantity must be a positive integer');
      err.code = 'AUTH_004';
      err.status = 400;
      throw err;
    }

    const booklet = await prisma.booklet.findUnique({ where: { id: bookletId } });
    if (!booklet) {
      const err = new Error('booklet not found');
      err.code = 'CAT_003';
      err.status = 404;
      throw err;
    }
    if (booklet.stock < quantity) {
      const err = new Error('insufficient stock');
      err.code = 'CART_001';
      err.status = 400;
      throw err;
    }

    const cart = await prisma.cart.findUnique({ where: { studentId } });
    if (!cart) {
      const err = new Error('cart not found');
      err.code = 'INF_001';
      err.status = 404;
      throw err;
    }

    const result = await prisma.cartItem.updateMany({
      where: { cartId: cart.id, bookletId },
      data: { quantity },
    });
    if (result.count === 0) {
      const err = new Error('cart or item not found');
      err.code = 'INF_001';
      err.status = 404;
      throw err;
    }

    return this.buildCartResponse(cart.id, studentId);
  }

  async removeItem(studentId, bookletId) {
    const cart = await prisma.cart.findUnique({ where: { studentId } });
    if (!cart) {
      const err = new Error('cart not found');
      err.code = 'INF_001';
      err.status = 404;
      throw err;
    }

    const result = await prisma.cartItem.deleteMany({
      where: { cartId: cart.id, bookletId },
    });
    if (result.count === 0) {
      const err = new Error('cart or item not found');
      err.code = 'INF_001';
      err.status = 404;
      throw err;
    }

    return this.buildCartResponse(cart.id, studentId);
  }

  async clear(studentId) {
    const cart = await prisma.cart.findUnique({ where: { studentId } });
    if (!cart) return; // nothing to clear
    await prisma.cartItem.deleteMany({ where: { cartId: cart.id } });
  }

  async getCart(studentId) {
    const cart = await prisma.cart.findUnique({ where: { studentId } });
    if (!cart) {
      return { studentId, items: [], total: 0 };
    }
    return this.buildCartResponse(cart.id, studentId);
  }

  async buildCartResponse(cartId, studentId) {
    const items = await prisma.cartItem.findMany({
      where: { cartId },
      orderBy: { createdAt: 'asc' },
    });

    let total = 0;
    const itemResponses = items.map((item) => {
      const subtotal = Number(item.unitPrice) * item.quantity;
      total += subtotal;
      return {
        ...item,
        unitPrice: Number(item.unitPrice),
        subtotal,
      };
    });

    return {
      id: cartId,
      studentId,
      items: itemResponses,
      total,
    };
  }
}
