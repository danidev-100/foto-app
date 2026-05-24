import app from './app.js';
import { config } from './config.js';
import { MercadoPagoGateway } from './lib/mercadopago.js';
import { initPaymentService } from './controllers/payment.controller.js';
import { prisma } from './lib/prisma.js';

// ── Ensure schema is up to date ─────────────────────────────────────
// Vercel Services skips vercel-build, so db push may never run.
// We sync missing columns manually using raw SQL instead.
async function ensureSchema() {
  try {
    // Check if schools table exists
    const tableResult = await prisma.$queryRawUnsafe(
      `SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'schools') AS e`
    );
    const hasSchoolsTable = tableResult[0]?.e;
    if (!hasSchoolsTable) {
      console.log('Missing schools table — creating it');
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

    // Check if courses.school_id column exists (added in refactor)
    const colResult = await prisma.$queryRawUnsafe(`
      SELECT EXISTS (
        SELECT FROM information_schema.columns
        WHERE table_name = 'courses' AND column_name = 'school_id'
      ) AS e
    `);
    const hasSchoolId = colResult[0]?.e;
    if (!hasSchoolId) {
      console.log('Missing courses.school_id — adding it');
      await prisma.$executeRawUnsafe(`
        ALTER TABLE courses ADD COLUMN school_id TEXT;
      `);
    }

    // Check if booklets.school_id column exists
    const bookletColResult = await prisma.$queryRawUnsafe(`
      SELECT EXISTS (
        SELECT FROM information_schema.columns
        WHERE table_name = 'booklets' AND column_name = 'school_id'
      ) AS e
    `);
    const hasBookletSchoolId = bookletColResult[0]?.e;
    if (!hasBookletSchoolId) {
      console.log('Missing booklets.school_id — adding it');
      await prisma.$executeRawUnsafe(`
        ALTER TABLE booklets ADD COLUMN school_id TEXT;
      `);
    }
  } catch (err) {
    console.warn('ensureSchema skipped:', err.message);
  }
}

// ── Ensure schools exist (seed data) ────────────────────────────────
async function ensureSchools() {
  const count = await prisma.school.count().catch(() => 0);
  if (count > 0) return;
  console.log('Seeding schools…');

  try {
    const donBosco = await prisma.school.create({
      data: { name: 'Colegio Don Bosco', shortName: 'Don Bosco' },
    });
    await prisma.school.create({
      data: { name: 'Instituto Rodeo del Medio', shortName: 'Rodeo del Medio' },
    });

    // Assign all courses to Don Bosco by default
    const courses = await prisma.course.findMany({ where: { isActive: true } });
    if (courses.length > 0) {
      await prisma.course.updateMany({
        where: { id: { in: courses.map(c => c.id) } },
        data: { schoolId: donBosco.id },
      });
      console.log(`Assigned ${courses.length} courses to ${donBosco.name}`);
    }
  } catch (err) {
    console.warn('ensureSchools skipped:', err.message);
  }
}

// ── Initialize Mercado Pago gateway ────────────────────────────────
const mpGateway = new MercadoPagoGateway(config.mpAccessToken, config.mpSandbox);
initPaymentService(mpGateway);

// ── Start server (after ensuring schema + schools) ─────────────────
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

// Sync schema, seed schools, then start
ensureSchema()
  .then(() => ensureSchools())
  .catch((err) => console.warn('ensureSchools failed:', err.message))
  .finally(() => {
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  });
