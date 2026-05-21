import { Router } from 'express';
import { PaymentController } from '../controllers/payment.controller.js';

const router = Router();
const paymentController = new PaymentController();

// Webhook: MP IPN (no auth — validated by idempotency)
router.post('/mercadopago', (req, res) => paymentController.handleMPWebhook(req, res));

export default router;
