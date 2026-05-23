import { execSync } from 'child_process';
import { dirname } from 'path';
import { fileURLToPath } from 'url';

import app from './app.js';
import { config } from './config.js';
import { MercadoPagoGateway } from './lib/mercadopago.js';
import { initPaymentService } from './controllers/payment.controller.js';
import { prisma } from './lib/prisma.js';

// ── Sync DB schema on startup ──────────────────────────────────────
// Vercel services mode doesn't run vercel-build, so we push schema here.
// Idempotent — only creates/updates missing tables.
try {
  const __dirname = dirname(fileURLToPath(import.meta.url));
  execSync('npx prisma db push --accept-data-loss --skip-generate', {
    cwd: __dirname + '/..',
    stdio: 'pipe',
  });
  console.log('Schema synced via prisma db push');
} catch (err) {
  // Non-fatal — schema may have been pushed already or DB not reachable
  console.warn('prisma db push warning (non-fatal):', err.message);
}

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
