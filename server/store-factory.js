import { createPersistence } from './persistence.js';
import { createPostgresPersistence } from './postgres-persistence.js';

export async function createConfiguredStore({ env = process.env } = {}) {
  if (!env.DATABASE_URL) {
    if (env.NODE_ENV === 'production') throw new Error('DATABASE_URL is required in production; JSON persistence is development-only.');
    return { store: createPersistence(), pool: null, backend: 'json' };
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
