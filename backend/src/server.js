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
// Use prisma binary directly (not npx) since npx can't write to /tmp.
try {
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const basedir = __dirname + '/..';
  execSync(
    `node "${basedir}/node_modules/prisma/build/index.js" db push --accept-data-loss --skip-generate`,
    { cwd: basedir, stdio: 'pipe', env: { ...process.env, HOME: '/tmp' } },
  );
  console.log('Schema synced via prisma db push');
} catch (err) {
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
