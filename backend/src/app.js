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
import { prisma } from './lib/prisma.js';

const app = express();

// ── Init schema + seed (runs once on first request) ─────────────────
// Vercel imports app.js as a serverless handler (bypasses server.js),
// so init MUST live here — not in server.js.
let initialized = false;

async function ensureSchema() {
  // Create schools table if missing
  const [tableResult] = await prisma.$queryRawUnsafe(
    `SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'schools') AS e`
  );
  if (!tableResult?.e) {
    console.log('Init: creating schools table');
    await prisma.$executeRawUnsafe(`
      CREATE TABLE schools (
        id TEXT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        short_name VARCHAR(100),
        is_active BOOLEAN NOT NULL DEFAULT true,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
  }

  // Add courses.school_id if missing
  const [colResult] = await prisma.$queryRawUnsafe(`
    SELECT EXISTS (
      SELECT FROM information_schema.columns
      WHERE table_name = 'courses' AND column_name = 'school_id'
    ) AS e
  `);
  if (!colResult?.e) {
    console.log('Init: adding courses.school_id');
    await prisma.$executeRawUnsafe(`ALTER TABLE courses ADD COLUMN school_id TEXT;`);
  }

  // Add booklets.school_id if missing
  const [bColResult] = await prisma.$queryRawUnsafe(`
    SELECT EXISTS (
      SELECT FROM information_schema.columns
      WHERE table_name = 'booklets' AND column_name = 'school_id'
    ) AS e
  `);
  if (!bColResult?.e) {
    console.log('Init: adding booklets.school_id');
    await prisma.$executeRawUnsafe(`ALTER TABLE booklets ADD COLUMN school_id TEXT;`);
  }
}

async function ensureSchools() {
  // Fix courses with NULL school_id using raw SQL (Prisma rejects null on non-nullable String field)
  const [nullResult] = await prisma.$queryRawUnsafe(
    `SELECT COUNT(*)::int AS cnt FROM courses WHERE school_id IS NULL`
  );
  const nullCourses = nullResult?.cnt ?? 0;
  if (nullCourses > 0) {
    const [schoolRow] = await prisma.$queryRawUnsafe(
      `SELECT id FROM schools LIMIT 1`
    );
    if (schoolRow) {
      await prisma.$executeRawUnsafe(
        `UPDATE courses SET school_id = '${schoolRow.id}' WHERE school_id IS NULL`
      );
    console.log(`Assigned ${nullCourses} courses to school ${schoolRow.id}`);
    await prisma.$executeRawUnsafe(
      `ALTER TABLE courses ALTER COLUMN school_id SET NOT NULL`
    );
  }

  // Same fix for booklets
  const [nullBookletResult] = await prisma.$queryRawUnsafe(
    `SELECT COUNT(*)::int AS cnt FROM booklets WHERE school_id IS NULL`
  );
  if ((nullBookletResult?.cnt ?? 0) > 0) {
    const [schoolRow] = await prisma.$queryRawUnsafe(
      `SELECT id FROM schools LIMIT 1`
    );
    if (schoolRow) {
      await prisma.$executeRawUnsafe(
        `UPDATE booklets SET school_id = '${schoolRow.id}' WHERE school_id IS NULL`
      );
      console.log(`Assigned ${nullBookletResult.cnt} booklets to school ${schoolRow.id}`);
      await prisma.$executeRawUnsafe(
        `ALTER TABLE booklets ALTER COLUMN school_id SET NOT NULL`
      );
    }
  }
  }

  // Seed schools if empty
  const [countResult] = await prisma.$queryRawUnsafe(
    `SELECT COUNT(*)::int AS cnt FROM schools`
  );
  const schoolCount = countResult?.cnt ?? 0;
  if (schoolCount > 0) return;
  console.log('Init: seeding schools…');

  const donBosco = await prisma.school.create({
    data: { name: 'Colegio Don Bosco', shortName: 'Don Bosco' },
  });
  await prisma.school.create({
    data: { name: 'Instituto Rodeo del Medio', shortName: 'Rodeo del Medio' },
  });

  const courses = await prisma.course.findMany({ where: { isActive: true } });
  if (courses.length > 0) {
    await prisma.course.updateMany({
      where: { id: { in: courses.map(c => c.id) } },
      data: { schoolId: donBosco.id },
    });
    console.log(`Assigned ${courses.length} courses to ${donBosco.name}`);
  }
}

app.use(async (_req, res, next) => {
  if (!initialized) {
    initialized = true;
    try {
      await ensureSchema();
      await ensureSchools();
      console.log('Init complete');
    } catch (err) {
      console.error('Init failed:', err);
    }
  }
  next();
});

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


// ── Error handler ──────────────────────────────────────────────────
app.use(errorMiddleware);

export default app;
