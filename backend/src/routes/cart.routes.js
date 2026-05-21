import { Router } from 'express';
import { CartController } from '../controllers/cart.controller.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();
const cartController = new CartController();

router.use(authMiddleware);

router.get('/', (req, res) => cartController.getCart(req, res));
router.post('/items', (req, res) => cartController.addItem(req, res));
router.put('/items/:booklet_id', (req, res) => cartController.updateItem(req, res));
router.delete('/items/:booklet_id', (req, res) => cartController.removeItem(req, res));
router.delete('/', (req, res) => cartController.clearCart(req, res));

export default router;
