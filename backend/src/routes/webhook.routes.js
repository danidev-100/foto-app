import { Router } from 'express';
import { PaymentController } from '../controllers/payment.controller.js';
import { getGateway } from '../lib/mercadopago.js';

const router = Router();
const paymentController = new PaymentController();

// Webhook: MP IPN — validado por firma HMAC + idempotencia
router.post('/mercadopago', (req, res) => {
  const gateway = getGateway();
  const rawBody = JSON.stringify(req.body);
  if (!gateway.validateWebhookSignature(req.headers, rawBody)) {
    return res.status(401).json({ success: false, error: { code: 'WEB_001', message: 'invalid webhook signature' } });
  }
  paymentController.handleMPWebhook(req, res);
});

export default router;
