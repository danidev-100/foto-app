import app from './app.js';
import { config } from './config.js';
import { MercadoPagoGateway } from './lib/mercadopago.js';
import { initPaymentService } from './controllers/payment.controller.js';
import { prisma } from './lib/prisma.js';

// ── Ensure schools exist (create tables + seed data) ──────────────
// Vercel services mode doesn't run vercel-build, so tables may not exist.
async function ensureSchools() {
  try {
    // Check if schools table already has the right schema
    const exists = await prisma.$queryRawUnsafe(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_name = 'schools'
      ) AS exists
    `);
    if (exists[0]?.exists) {
      // Table exists — just seed if empty, skip DROP/CREATE
      const count = await prisma.school.count();
      if (count > 0) return; // already seeded
    } else {
      // Create fresh tables
      await prisma.$executeRawUnsafe(`
        CREATE TABLE schools (
          id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
          name VARCHAR(255) NOT NULL,
          short_name VARCHAR(100),
          is_active BOOLEAN NOT NULL DEFAULT true,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
      `);
      await prisma.$executeRawUnsafe(`
        CREATE TABLE school_courses (
          school_id TEXT NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
          course_id TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
          PRIMARY KEY (school_id, course_id)
        );
      `);
      console.log('Created schools + school_courses tables');
    }

    // Seed schools if empty
    const count = await prisma.school.count();
    if (count === 0) {
      const donBosco = await prisma.school.create({
        data: { name: 'Colegio Don Bosco', shortName: 'Don Bosco' },
      });
      const rodeo = await prisma.school.create({
        data: { name: 'Instituto Rodeo del Medio', shortName: 'Rodeo del Medio' },
      });
      const courses = await prisma.course.findMany({ where: { isActive: true } });
      for (const course of courses) {
        try {
          await prisma.schoolCourse.createMany({
            data: [
              { schoolId: donBosco.id, courseId: course.id },
              { schoolId: rodeo.id, courseId: course.id },
            ],
          });
        } catch {
          // ignore duplicate links
        }
      }
      console.log(`Seeded ${courses.length} courses into both schools`);
    }
  } catch (err) {
    console.warn('ensureSchools skipped (non-fatal):', err.message);
  }
}
// ── Initialize Mercado Pago gateway ────────────────────────────────
const mpGateway = new MercadoPagoGateway(config.mpAccessToken, config.mpSandbox);
initPaymentService(mpGateway);

// ── Start server (after ensuring schools exist) ────────────────────
const PORT = config.port;

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('SIGINT received — shutting down');
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('SIGTERM received — shutting down');
  await prisma.$disconnect();
  process.exit(0);
});

// Ensure schools, then start listening (with timeout to avoid blocking startup)
Promise.race([
  ensureSchools(),
  new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 15000)),
]).catch((err) => console.warn('ensureSchools skipped:', err.message))
  .finally(() => {
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  });
