import { v4 as uuidv4 } from 'uuid';
import { prisma } from '../lib/prisma.js';
import { config } from '../config.js';

/**
 * CheckoutService handles the initial phase of MP checkout:
 * validates cart, snapshots it, creates MP preference, returns payment URL.
 * NO order is created — that happens in the webhook when MP confirms payment.
 */
export class CheckoutService {
  constructor(gateway) {
    this.gateway = gateway;
  }

  async initMPCheckout(studentId) {
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

      // 2. Validate stock and compute total
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

        total += Number(item.unitPrice) * item.quantity;

        if (item.deliveryDays && item.deliveryDays > maxDeliveryDays) {
          maxDeliveryDays = item.deliveryDays;
          hasDeliveryDays = true;
        }
      }

      // 3. Snapshot cart items as JSON
      const snapshot = cartItems.map((item) => ({
        bookletId: item.bookletId,
        title: item.title,
        quantity: item.quantity,
        unitPrice: Number(item.unitPrice),
        deliveryDays: item.deliveryDays,
      }));

      // 4. Calculate delivery date
      let deliveryDate = null;
      if (hasDeliveryDays && maxDeliveryDays > 0) {
        deliveryDate = new Date(Date.now() + maxDeliveryDays * 24 * 60 * 60 * 1000);
      }

      // 5. Create pending checkout (NO order yet)
      const checkout = await tx.pendingCheckout.create({
        data: {
          id: uuidv4(),
          studentId,
          total,
          items: snapshot,
          expiresAt: new Date(Date.now() + 30 * 60 * 1000), // 30 min
        },
      });

      // 6. Create MP preference with checkout id as external_reference
      const mpItems = cartItems.map((item) => ({
        title: item.title,
        quantity: item.quantity,
        unitPrice: Number(item.unitPrice) / 100,
        currencyId: 'ARS',
      }));

      const pref = await this.gateway.createPreference(checkout.id, mpItems, {
        success: `${config.frontendUrl}/orders?mp_redirect=success`,
        failure: `${config.frontendUrl}/orders?mp_redirect=failure`,
        pending: `${config.frontendUrl}/orders?mp_redirect=pending`,
      });

      // 7. Save the MP preference id
      await tx.pendingCheckout.update({
        where: { id: checkout.id },
        data: { mpPreferenceId: pref.id },
      });

      return {
        checkoutId: checkout.id,
        paymentUrl: pref.initPoint,
        deliveryDate,
      };
    });
  }
}
