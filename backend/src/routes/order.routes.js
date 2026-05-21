import { Router } from 'express';
import { OrderController } from '../controllers/order.controller.js';
import { PaymentController } from '../controllers/payment.controller.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();
const orderController = new OrderController();
const paymentController = new PaymentController();

router.use(authMiddleware);

// Student-facing order routes
router.post('/', (req, res) => orderController.placeOrder(req, res));
router.get('/', (req, res) => orderController.listOrders(req, res));
router.get('/:id', (req, res) => orderController.getOrder(req, res));
router.post('/:id/cancel', (req, res) => orderController.cancelOrder(req, res));

// Payment: initiate payment for an order
router.post('/:id/pay', (req, res) => paymentController.initiatePayment(req, res));

export default router;
