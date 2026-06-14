import dotenv from 'dotenv';
dotenv.config();

export const config = {
  port: parseInt(process.env.SERVER_PORT || '8080', 10),
  databaseUrl: process.env.DATABASE_URL || '',
  jwtSecret: process.env.JWT_SECRET || '',
  jwtExpiration: process.env.JWT_EXPIRATION || '15m',
  jwtRefreshExpiration: process.env.JWT_REFRESH_EXPIRATION || '7d',
  authRateLimitMax: parseInt(process.env.AUTH_RATE_LIMIT_MAX || '20', 10),
  mpAccessToken: process.env.MP_ACCESS_TOKEN || '',
  mpSandbox: process.env.MP_SANDBOX !== 'false',
  mpWebhookSecret: process.env.MP_WEBHOOK_SECRET || '',
  frontendUrl: process.env.FRONTEND_URL
    || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null)
    || process.env.CORS_ORIGIN
    || 'http://localhost:80',
  logLevel: process.env.LOG_LEVEL || 'info',

  // Bank transfer details
  bankName: process.env.BANK_NAME || '',
  bankCbu: process.env.BANK_CBU || '',
  bankAlias: process.env.BANK_ALIAS || '',
  bankHolder: process.env.BANK_HOLDER || '',
  bankCuit: process.env.BANK_CUIT || '',

  // Email (SMTP)
  smtpHost: process.env.SMTP_HOST || '',
  smtpPort: parseInt(process.env.SMTP_PORT || '587', 10),
  smtpUser: process.env.SMTP_USER || '',
  smtpPass: process.env.SMTP_PASS || '',
  emailFrom: process.env.EMAIL_FROM || '',
};

if (!config.databaseUrl) throw new Error('DATABASE_URL is required');
if (!config.jwtSecret) throw new Error('JWT_SECRET is required');
