import express from 'express';
import cors from 'cors';
import morgan from 'morgan';

import { healthCheck } from './controllers/health.controller.js';
import authRoutes from './routes/auth.routes.js';
import catalogRoutes from './routes/catalog.routes.js';
import adminRoutes from './routes/admin.routes.js';
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

// Convert Prisma Decimal objects to numbers for JSON serialization
app.use((req, res, next) => {
  const originalJson = res.json.bind(res);
  res.json = (body) => {
    if (body) {
      body = sanitizeDecimals(body);
    }
    return originalJson(body);
  };
  next();
});

function sanitizeDecimals(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(sanitizeDecimals);
  
  const result = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value && typeof value === 'object' && typeof value.toNumber === 'function') {
      result[key] = value.toNumber();
    } else if (value && typeof value === 'object') {
      result[key] = sanitizeDecimals(value);
    } else {
      result[key] = value;
    }
  }
  return result;
}

// ── Routes ─────────────────────────────────────────────────────────
app.get('/api/health', healthCheck);
app.use('/api/auth', authRoutes);
app.use('/api/catalog', catalogRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/webhooks', webhookRoutes);

// ── Error handler ──────────────────────────────────────────────────
app.use(errorMiddleware);

export default app;
