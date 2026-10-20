import { createPersistence } from './persistence.js';
import { createPostgresPersistence } from './postgres-persistence.js';

export async function createConfiguredStore({ env = process.env } = {}) {
  if (!env.DATABASE_URL) return { store: createPersistence(), pool: null, backend: 'json' };
  if (env.NODE_ENV === 'production' && env.BUILDER_ALLOW_JSON_STORE === 'true') {
    throw new Error('JSON persistence is not allowed in production when DATABASE_URL is configured.');
  }
  const { Pool } = await import('pg');
  const pool = new Pool({
    connectionString: env.DATABASE_URL,
    max: Number.parseInt(env.PG_POOL_MAX || '10', 10),
    connectionTimeoutMillis: 5000,
    idleTimeoutMillis: 30000,
    ssl: env.PGSSLMODE === 'require' ? { rejectUnauthorized: env.PGSSL_REJECT_UNAUTHORIZED !== 'false' } : undefined
  });
  await pool.query('SELECT 1');
  return {
    store: createPostgresPersistence({ pool, encryptionKey: env.BUILDER_ENCRYPTION_KEY }),
    pool,
    backend: 'postgres'
  };
}
