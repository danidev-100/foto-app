import { Router } from 'express';
import { CheckoutController } from '../controllers/checkout.controller.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();
const checkoutController = new CheckoutController();

router.use(authMiddleware);

router.post('/mp', (req, res) => checkoutController.initMPCheckout(req, res));

export default router;
