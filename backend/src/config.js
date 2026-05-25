import dotenv from 'dotenv';
dotenv.config();

export const config = {
  port: parseInt(process.env.SERVER_PORT || '8080', 10),
  databaseUrl: process.env.DATABASE_URL || '',
  jwtSecret: process.env.JWT_SECRET || '',
  jwtExpiration: process.env.JWT_EXPIRATION || '24h',
  mpAccessToken: process.env.MP_ACCESS_TOKEN || '',
  mpSandbox: process.env.MP_SANDBOX !== 'false',
  mpWebhookSecret: process.env.MP_WEBHOOK_SECRET || '',
  logLevel: process.env.LOG_LEVEL || 'info',

  // Bank transfer details
  bankName: process.env.BANK_NAME || '',
  bankCbu: process.env.BANK_CBU || '',
  bankAlias: process.env.BANK_ALIAS || '',
  bankHolder: process.env.BANK_HOLDER || '',
  bankCuit: process.env.BANK_CUIT || '',
};

if (!config.databaseUrl) throw new Error('DATABASE_URL is required');
if (!config.jwtSecret) throw new Error('JWT_SECRET is required');
