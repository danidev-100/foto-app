import dotenv from 'dotenv';
dotenv.config();

export const config = {
  port: parseInt(process.env.SERVER_PORT || '8080', 10),
  databaseUrl: process.env.DATABASE_URL || '',
  jwtSecret: process.env.JWT_SECRET || '',
  jwtExpiration: process.env.JWT_EXPIRATION || '24h',
  mpAccessToken: process.env.MP_ACCESS_TOKEN || '',
  mpSandbox: process.env.MP_SANDBOX !== 'false',
  logLevel: process.env.LOG_LEVEL || 'info',
};

if (!config.databaseUrl) throw new Error('DATABASE_URL is required');
if (!config.jwtSecret) throw new Error('JWT_SECRET is required');
