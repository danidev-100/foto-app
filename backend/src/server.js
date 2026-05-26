import app from './app.js';
import { config } from './config.js';
import { initGateway } from './lib/mercadopago.js';
import { initPaymentService } from './controllers/payment.controller.js';
import { initCheckoutService } from './controllers/checkout.controller.js';
import { prisma } from './lib/prisma.js';

// ── Initialize Mercado Pago gateway (singleton) ─────────────────────
const mpGateway = initGateway(config.mpAccessToken, config.mpSandbox, config.mpWebhookSecret);
initPaymentService(mpGateway);
initCheckoutService(mpGateway);

// ── Start server ───────────────────────────────────────────────────
const PORT = config.port;

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
