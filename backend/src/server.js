import app from './app.js';
import { config } from './config.js';
import { MercadoPagoGateway } from './lib/mercadopago.js';
import { initPaymentService } from './controllers/payment.controller.js';
import { prisma } from './lib/prisma.js';

// ── Ensure schools exist (create tables + seed data) ──────────────
// Vercel services mode doesn't run vercel-build, so tables may not exist.
async function ensureSchools() {
  try {
    // Drop old schema (UUID type) first, recreate with TEXT to match Prisma types
    await prisma.$executeRawUnsafe(`DROP TABLE IF EXISTS school_courses;`);
    await prisma.$executeRawUnsafe(`DROP TABLE IF EXISTS schools;`);
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
    console.log('Ensured schools + school_courses tables exist');
  } catch (err) {
    console.warn('Could not ensure schools tables (non-fatal):', err.message);
    return;
  }

  // Seed schools if empty
  try {
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
        await prisma.schoolCourse.createMany({
          data: [
            { schoolId: donBosco.id, courseId: course.id },
            { schoolId: rodeo.id, courseId: course.id },
          ],
        });
      }
      console.log(`Seeded ${courses.length} courses into both schools`);
    }
  } catch (err) {
    console.warn('Could not seed schools (non-fatal):', err.message);
  }
}
ensureSchools();

// ── Initialize Mercado Pago gateway ────────────────────────────────
const mpGateway = new MercadoPagoGateway(config.mpAccessToken, config.mpSandbox);
initPaymentService(mpGateway);

// ── Start server ───────────────────────────────────────────────────
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

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
