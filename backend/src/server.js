import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import app from './app.js';
import { config } from './config.js';
import { MercadoPagoGateway } from './lib/mercadopago.js';
import { initPaymentService } from './controllers/payment.controller.js';
import { prisma } from './lib/prisma.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── Ensure schema is up to date ─────────────────────────────────────
// Vercel Services skips vercel-build, so db push may never run.
// We run it here at startup so the DB schema always matches.
async function ensureSchema() {
  try {
    const prismaCli = resolve(__dirname, '../../node_modules/.bin/prisma');
    const cmd = existsSync(prismaCli)
      ? `"${prismaCli}" db push --accept-data-loss`
      : 'npx prisma db push --accept-data-loss';
    execSync(cmd, { cwd: resolve(__dirname, '..'), stdio: 'pipe', timeout: 30000 });
    console.log('Schema synced via prisma db push');
  } catch (err) {
    console.warn('prisma db push failed (non-fatal):', err.message);
  }
}

// ── Ensure schools exist (seed data) ────────────────────────────────
async function ensureSchools() {
  const count = await prisma.school.count();
  if (count > 0) return;
  console.log('Seeding schools…');

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
