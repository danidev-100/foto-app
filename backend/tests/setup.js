/**
 * Test setup — ensures env vars exist before any test runs.
 * dotenv is already loaded in vitest.config.js.
 */
if (!process.env.JWT_SECRET) {
  process.env.JWT_SECRET = 'test-secret-key-for-tests';
}
