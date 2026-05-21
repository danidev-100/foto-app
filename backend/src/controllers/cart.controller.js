import { CartService } from '../services/cart.service.js';
import { successJSON, errorJSON } from '../lib/response.js';

const cartService = new CartService();

export class CartController {
  async getCart(req, res) {
    try {
      const cart = await cartService.getCart(req.studentId);
      return successJSON(res, 200, cart);
    } catch (err) {
      return errorJSON(res, 500, 'INF_001', 'failed to get cart');
    }
  }

  async addItem(req, res) {
    const { booklet_id: bookletId, quantity } = req.body;
    if (!bookletId || !quantity || quantity <= 0) {
      return errorJSON(res, 400, 'AUTH_004', 'booklet_id and a positive quantity are required');
    }

    try {
      const cart = await cartService.addItem(req.studentId, { bookletId, quantity });
      return successJSON(res, 201, cart);
    } catch (err) {
      if (err.code === 'CAT_003') return errorJSON(res, 404, 'CAT_003', 'booklet not found');
      if (err.code === 'CART_001') return errorJSON(res, 400, 'CART_001', 'insufficient stock');
      return errorJSON(res, 500, 'INF_001', 'failed to add item to cart');
    }
  }

  async updateItem(req, res) {
    const { quantity } = req.body;
    if (!quantity || quantity <= 0) {
      return errorJSON(res, 400, 'AUTH_004', 'quantity must be a positive integer');
    }

    try {
      const cart = await cartService.updateItem(req.studentId, req.params.booklet_id, { quantity });
      return successJSON(res, 200, cart);
    } catch (err) {
      if (err.code === 'CAT_003') return errorJSON(res, 404, 'CAT_003', 'booklet not found');
      if (err.code === 'CART_001') return errorJSON(res, 400, 'CART_001', 'insufficient stock');
      if (err.code === 'INF_001') return errorJSON(res, 404, 'INF_001', 'cart or item not found');
      return errorJSON(res, 500, 'INF_001', 'failed to update cart item');
    }
  }

  async removeItem(req, res) {
    try {
      const cart = await cartService.removeItem(req.studentId, req.params.booklet_id);
      return successJSON(res, 200, cart);
    } catch (err) {
      if (err.code === 'INF_001') return errorJSON(res, 404, 'INF_001', 'cart or item not found');
      return errorJSON(res, 500, 'INF_001', 'failed to remove cart item');
    }
  }

  async clearCart(req, res) {
    try {
      await cartService.clear(req.studentId);
      return successJSON(res, 200, { message: 'cart cleared' });
    } catch (err) {
      return errorJSON(res, 500, 'INF_001', 'failed to clear cart');
    }
  }
}
