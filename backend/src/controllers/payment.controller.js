import { PaymentService } from '../services/payment.service.js';
import { successJSON, errorJSON } from '../lib/response.js';

let paymentService;

export function initPaymentService(gateway) {
  paymentService = new PaymentService(gateway);
}

let _defaultService;

function getPaymentService() {
  if (paymentService) return paymentService;
  if (!_defaultService) {
    _defaultService = new PaymentService(null);
  }
  return _defaultService;
}

export class PaymentController {
  async initiatePayment(req, res) {
    const { method } = req.body;
    if (!method) return errorJSON(res, 400, 'AUTH_004', 'method is required (mercadopago or cash)');

    try {
      const result = await paymentService.initiatePayment(req.studentId, req.params.id, method);
      return successJSON(res, 201, result);
    } catch (err) {
      if (err.code === 'INF_001') return errorJSON(res, 404, 'INF_001', 'order not found');
      if (err.code === 'PAY_002') return errorJSON(res, 400, 'PAY_002', 'invalid payment method for this order');
      if (err.code === 'PAY_003') return errorJSON(res, 400, 'PAY_003', 'order already paid');
      return errorJSON(res, 500, 'INF_001', 'internal server error');
    }
  }

  async handleMPWebhook(req, res) {
    const rawBody = JSON.stringify(req.body);
    if (!rawBody || rawBody === '{}') {
      return res.status(200).end();
    }

    try {
      await paymentService.handleMPWebhook(rawBody);
    } catch (err) {
      // Log but always return 200 — MP retries on non-200
      console.error('MP Webhook error:', err);
    }
    return res.status(200).end();
  }

  async confirmCashPayment(req, res) {
    try {
      await getPaymentService().confirmCashPayment(req.params.id, req.studentId);
      return successJSON(res, 200, { message: 'cash payment confirmed' });
    } catch (err) {
      if (err.code === 'INF_001') return errorJSON(res, 404, 'INF_001', 'order or payment not found');
      if (err.code === 'PAY_006') return errorJSON(res, 400, 'PAY_006', 'payment method is not cash');
      if (err.code === 'PAY_003') return errorJSON(res, 400, 'PAY_003', 'payment already processed');
      return errorJSON(res, 500, 'INF_001', 'internal server error');
    }
  }

  async confirmTransfer(req, res) {
    try {
      await getPaymentService().confirmTransferPayment(req.params.id, req.studentId);
      return successJSON(res, 200, { message: 'transfer payment confirmed' });
    } catch (err) {
      if (err.code === 'INF_001') return errorJSON(res, 404, 'INF_001', 'order or payment not found');
      if (err.code === 'PAY_006') return errorJSON(res, 400, 'PAY_006', 'payment method is not transfer');
      if (err.code === 'PAY_003') return errorJSON(res, 400, 'PAY_003', 'payment already processed');
      return errorJSON(res, 500, 'INF_001', 'internal server error');
    }
  }
}
