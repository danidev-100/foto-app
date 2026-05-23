import app from './app.js';
import { config } from './config.js';
import { MercadoPagoGateway } from './lib/mercadopago.js';
import { initPaymentService } from './controllers/payment.controller.js';
import { prisma } from './lib/prisma.js';

// ── Ensure schools exist (create tables + seed data) ──────────────
// Vercel services mode doesn't run vercel-build, so tables may not exist.
async function ensureSchools() {
  try {
    // Check if schools table exists
    const result = await prisma.$queryRawUnsafe(
      `SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'schools') AS e`
    );
    const hasSchools = result[0]?.e;

    // Create schools table if missing
    if (!hasSchools) {
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
      console.log('Created schools table');
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

      // Assign all courses to Don Bosco by default
      const courses = await prisma.course.findMany({ where: { isActive: true } });
      await prisma.course.updateMany({
        where: { id: { in: courses.map(c => c.id) } },
        data: { schoolId: donBosco.id },
      });
      console.log(`Assigned ${courses.length} courses to ${donBosco.name}`);
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
