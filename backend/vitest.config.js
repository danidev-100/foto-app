import { defineConfig } from 'vitest/config';
import dotenv from 'dotenv';

// Load .env before vitest processes test files so Prisma can connect
dotenv.config();

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./tests/setup.js'],
    testTimeout: 30000,
    hookTimeout: 30000,
    sequence: { concurrent: false },
    fileParallelism: false,
    reporters: ['verbose'],
  },
});
