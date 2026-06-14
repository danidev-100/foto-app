import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import morgan from 'morgan';

import { healthCheck } from './controllers/health.controller.js';
import authRoutes from './routes/auth.routes.js';
import catalogRoutes from './routes/catalog.routes.js';
import adminRoutes from './routes/admin.routes.js';
import cartRoutes from './routes/cart.routes.js';
import orderRoutes from './routes/order.routes.js';
import checkoutRoutes from './routes/checkout.routes.js';
import webhookRoutes from './routes/webhook.routes.js';
import { config } from './config.js';
import { errorMiddleware } from './middleware/error.js';
import { authMiddleware } from './middleware/auth.js';
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

  // Create pending_checkouts table if missing
  const [pcResult] = await prisma.$queryRawUnsafe(
    `SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'pending_checkouts') AS e`
  );
  if (!pcResult?.e) {
    console.log('Init: creating pending_checkouts table');
    await prisma.$executeRawUnsafe(`
      CREATE TABLE pending_checkouts (
        id TEXT PRIMARY KEY,
        student_id TEXT NOT NULL REFERENCES students(id),
        total DECIMAL(10,2) NOT NULL,
        items JSONB NOT NULL,
        status VARCHAR(50) NOT NULL DEFAULT 'pending',
        mp_preference_id VARCHAR(255),
        expires_at TIMESTAMPTZ NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    await prisma.$executeRawUnsafe(`CREATE INDEX idx_pending_checkouts_student_id ON pending_checkouts(student_id)`);
    await prisma.$executeRawUnsafe(`CREATE INDEX idx_pending_checkouts_status ON pending_checkouts(status)`);
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
  // ── Migrate from old M:N school_courses table if it still exists ──
  const [oldTableResult] = await prisma.$queryRawUnsafe(
    `SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'school_courses') AS e`
  );
  if (oldTableResult?.e) {
    console.log('Migrating data from school_courses (old M:N) to courses.school_id');
    await prisma.$executeRawUnsafe(`
      UPDATE courses
      SET school_id = sc.school_id
      FROM school_courses sc
      WHERE courses.id = sc.course_id AND courses.school_id IS NULL
    `);
    // Drop the old table so future startups skip this
    await prisma.$executeRawUnsafe(`DROP TABLE school_courses`);
    console.log('school_courses table migrated and dropped');
  }

  // ── Fix remaining courses with NULL school_id ──
  const [nullResult] = await prisma.$queryRawUnsafe(
    `SELECT COUNT(*)::int AS cnt FROM courses WHERE school_id IS NULL`
  );
  const nullCourses = nullResult?.cnt ?? 0;
  if (nullCourses > 0) {
    // Assign orphan courses to Don Bosco
    const [donBosco] = await prisma.$queryRawUnsafe(
      `SELECT id FROM schools ORDER BY name ASC LIMIT 1`
    );
    if (donBosco) {
      await prisma.$executeRawUnsafe(
        `UPDATE courses SET school_id = $1 WHERE school_id IS NULL`,
        donBosco.id
      );
      console.log(`Assigned ${nullCourses} orphan courses to ${donBosco.id}`);
    }
  }

  // ── Ensure courses.school_id is NOT NULL ──
  const [colNull] = await prisma.$queryRawUnsafe(`
    SELECT COUNT(*)::int AS cnt FROM information_schema.columns
    WHERE table_name = 'courses' AND column_name = 'school_id' AND is_nullable = 'YES'
  `);
  if ((colNull?.cnt ?? 0) > 0) {
    await prisma.$executeRawUnsafe(
      `ALTER TABLE courses ALTER COLUMN school_id SET NOT NULL`
    );
  }

  // ── Same fix for booklets ──
  const [nullBookletResult] = await prisma.$queryRawUnsafe(
    `SELECT COUNT(*)::int AS cnt FROM booklets WHERE school_id IS NULL`
  );
  if ((nullBookletResult?.cnt ?? 0) > 0) {
    const [firstSchool] = await prisma.$queryRawUnsafe(
      `SELECT id FROM schools LIMIT 1`
    );
    if (firstSchool) {
      await prisma.$executeRawUnsafe(
        `UPDATE booklets SET school_id = $1 WHERE school_id IS NULL`,
        firstSchool.id
      );
      console.log(`Assigned ${nullBookletResult.cnt} orphan booklets to school ${firstSchool.id}`);
    }
  }

  const [bColNull] = await prisma.$queryRawUnsafe(`
    SELECT COUNT(*)::int AS cnt FROM information_schema.columns
    WHERE table_name = 'booklets' AND column_name = 'school_id' AND is_nullable = 'YES'
  `);
  if ((bColNull?.cnt ?? 0) > 0) {
    await prisma.$executeRawUnsafe(
      `ALTER TABLE booklets ALTER COLUMN school_id SET NOT NULL`
    );
  }

  // Seed schools if empty
  const [countResult] = await prisma.$queryRawUnsafe(
    `SELECT COUNT(*)::int AS cnt FROM schools`
  );
  const schoolCount = countResult?.cnt ?? 0;
  if (schoolCount > 0) return;
  console.log('Init: seeding schools…');

  await prisma.school.create({
    data: { name: 'Colegio Don Bosco', shortName: 'Don Bosco' },
  });
  await prisma.school.create({
    data: { name: 'Instituto Rodeo del Medio', shortName: 'Rodeo del Medio' },
  });
  console.log('Schools seeded — courses will be created by ensureCoursesExist()');
}

// ── Standard course structure (mirrors frontend COURSE_STRUCTURE) ──
const STANDARD_COURSES = [
  // Primaria
  { name: 'Primaria - Jardín',     divisions: ['A', 'B', 'C'] },
  { name: 'Primaria - 1° Primero', divisions: ['A', 'B', 'C'] },
  { name: 'Primaria - 2° Segundo', divisions: ['A', 'B', 'C'] },
  { name: 'Primaria - 3° Tercero', divisions: ['A', 'B', 'C'] },
  { name: 'Primaria - 4° Cuarto',  divisions: ['A', 'B', 'C'] },
  { name: 'Primaria - 5° Quinto',  divisions: ['A', 'B', 'C'] },
  { name: 'Primaria - 6° Sexto',   divisions: ['A', 'B', 'C'] },
  { name: 'Primaria - 7° Séptimo', divisions: ['A', 'B', 'C'] },
  // Secundaria
  { name: 'Secundaria - 1° Primero', divisions: ['A', 'B', 'C', 'D', 'E'] },
  { name: 'Secundaria - 2° Segundo', divisions: ['A', 'B', 'C', 'D', 'E'] },
  { name: 'Secundaria - 3° Tercero', divisions: ['A', 'B', 'N', 'H'] },
  { name: 'Secundaria - 4° Cuarto',  divisions: ['A', 'B', 'N', 'H'] },
  { name: 'Secundaria - 5° Quinto',  divisions: ['A', 'B', 'N', 'H'] },
];

async function ensureCoursesExist() {
  const schools = await prisma.school.findMany({ where: { isActive: true } });
  for (const school of schools) {
    const courseCount = await prisma.course.count({
      where: { schoolId: school.id, isActive: true },
    });
    if (courseCount > 0) {
      console.log(`School "${school.name}" already has ${courseCount} courses — skipping`);
      continue;
    }

    console.log(`Creating standard courses for "${school.name}"…`);
    for (const sc of STANDARD_COURSES) {
      const course = await prisma.course.create({
        data: {
          name: sc.name,
          description: null,
          isActive: true,
          schoolId: school.id,
          divisions: {
            create: sc.divisions.map(d => ({
              name: d,
              isActive: true,
            })),
          },
        },
      });
      console.log(`  Created course "${course.name}" with ${sc.divisions.length} divisions`);
    }
  }
}

app.use(async (_req, res, next) => {
  if (!initialized) {
    initialized = true;
    try {
      await ensureSchema();
      await ensureSchools();
      await ensureCoursesExist();
      console.log('Init complete');
    } catch (err) {
      console.error('Init failed:', err);
    }
  }
  next();
});

// ── Security middleware ────────────────────────────────────────────
app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:80',
  methods: 'GET,POST,PUT,DELETE,PATCH',
  allowedHeaders: 'Content-Type,Authorization',
}));

// Rate limiting
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: config.authRateLimitMax, // configurable via AUTH_RATE_LIMIT_MAX env
  standardHeaders: true,
  legacyHeaders: false,
  validate: { xForwardedForHeader: false },
  message: { success: false, error: { code: 'RATE_001', message: 'demasiados intentos, intentá de nuevo en 15 minutos' } },
});

// Apply rate limiter to auth routes only (login/register)
app.use('/api/auth', authLimiter);

// ── General middleware ─────────────────────────────────────────────
app.use(morgan('dev'));
app.use(express.json({ limit: '100kb' }));

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

// Protected config routes (require auth)
app.get('/api/config/bank-details', authMiddleware, getBankDetails);
app.use('/api/catalog', catalogRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/checkout', checkoutRoutes);
app.use('/api/webhooks', webhookRoutes);


// ── Error handler ──────────────────────────────────────────────────
app.use(errorMiddleware);

export default app;
