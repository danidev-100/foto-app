import { CheckoutService } from '../services/checkout.service.js';
import { successJSON, errorJSON } from '../lib/response.js';

let checkoutService;

export function initCheckoutService(gateway) {
  checkoutService = new CheckoutService(gateway);
  return checkoutService;
}

export class CheckoutController {
  async initMPCheckout(req, res) {
    try {
      const result = await checkoutService.initMPCheckout(req.studentId);
      return successJSON(res, 201, result);
    } catch (err) {
      if (err.code === 'CART_002') return errorJSON(res, 400, 'CART_002', 'cart is empty');
      if (err.code === 'CART_001') return errorJSON(res, 400, 'CART_001', 'insufficient stock for one or more items');
      return errorJSON(res, 500, 'INF_001', 'failed to initialize checkout');
    }
  }
}
