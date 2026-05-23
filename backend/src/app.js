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
import { getBankDetails } from './controllers/config.controller.js';

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
app.get('/api/config/bank-details', getBankDetails);
app.use('/api/auth', authRoutes);
app.use('/api/catalog', catalogRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/webhooks', webhookRoutes);

// ── TEMPORARY: seed schools in production ──────────────────────────
// TODO: remove after first successful run
import { authMiddleware, adminMiddleware } from './middleware/auth.js';
app.post('/api/admin/seed-schools', authMiddleware, adminMiddleware, async (_req, res) => {
  try {
    const { PrismaClient } = await import('@prisma/client');
    const prisma = new PrismaClient();
    const results = [];

    const schoolData = [
      { name: 'Colegio Don Bosco', shortName: 'Don Bosco' },
      { name: 'Instituto Rodeo del Medio', shortName: 'Rodeo del Medio' },
    ];

    for (const s of schoolData) {
      const existing = await prisma.school.findFirst({ where: { name: s.name } });
      if (existing) {
        results.push({ school: s.name, status: 'already exists', id: existing.id });
      } else {
        const created = await prisma.school.create({ data: s });
        results.push({ school: created.name, status: 'created', id: created.id });
      }
    }

    const courses = await prisma.course.findMany({ where: { isActive: true } });
    let linked = 0;
    for (const schoolId of results.map(r => r.id)) {
      for (const course of courses) {
        const exists = await prisma.schoolCourse.findUnique({
          where: { schoolId_courseId: { schoolId, courseId: course.id } },
        });
        if (!exists) {
          await prisma.schoolCourse.create({ data: { schoolId, courseId: course.id } });
          linked++;
        }
      }
    }

    await prisma.$disconnect();
    res.json({ success: true, schools: results, coursesLinked: linked });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── Error handler ──────────────────────────────────────────────────
app.use(errorMiddleware);

export default app;
