import express from 'express';
import cors from 'cors';
import morgan from 'morgan';

import { healthCheck } from './controllers/health.controller.js';
import authRoutes from './routes/auth.routes.js';
import catalogRoutes from './routes/catalog.routes.js';
import cartRoutes from './routes/cart.routes.js';
import orderRoutes from './routes/order.routes.js';
import webhookRoutes from './routes/webhook.routes.js';
import { errorMiddleware } from './middleware/error.js';

const app = express();

// ── Global middleware ──────────────────────────────────────────────
app.use(cors({
  origin: '*',
  methods: 'GET,POST,PUT,DELETE,PATCH',
  allowedHeaders: 'Content-Type,Authorization',
}));
app.use(morgan('dev'));
app.use(express.json());

// ── Routes ─────────────────────────────────────────────────────────
app.get('/api/health', healthCheck);
app.use('/api/auth', authRoutes);
app.use('/api/catalog', catalogRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/webhooks', webhookRoutes);

// ── Error handler ──────────────────────────────────────────────────
app.use(errorMiddleware);

export default app;
