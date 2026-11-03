import { readdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const migrationsDirectory = join(here, 'migrations');

export async function inspectMigrationStatus(pool) {
  const files = (await readdir(migrationsDirectory))
    .filter(name => /^\d+_[a-z0-9_-]+\.sql$/.test(name))
    .sort();
  const table = await pool.query("SELECT to_regclass('public.builder_schema_migrations') AS table_name");
  const exists = Boolean(table.rows[0]?.table_name);
  const applied = exists
    ? (await pool.query('SELECT name FROM builder_schema_migrations ORDER BY name')).rows.map(row => row.name)
    : [];
  const known = new Set(files);
  return {
    applied,
    pending: files.filter(name => !applied.includes(name)),
    unknown: applied.filter(name => !known.has(name))
  };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL is required. Point it only at the dedicated AI Builder database.');
    process.exitCode = 1;
  } else {
    const { Pool } = await import('pg');
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      connectionTimeoutMillis: 5000,
      ssl: process.env.PGSSLMODE === 'require'
        ? { rejectUnauthorized: process.env.PGSSL_REJECT_UNAUTHORIZED !== 'false' }
        : undefined
    });
    try {
      const status = await inspectMigrationStatus(pool);
      console.log('Applied migrations (' + status.applied.length + '): ' + (status.applied.join(', ') || 'none'));
      console.log('Pending migrations (' + status.pending.length + '): ' + (status.pending.join(', ') || 'none'));
      if (status.unknown.length) console.error('Unknown applied migrations: ' + status.unknown.join(', '));
      if (status.pending.length || status.unknown.length) process.exitCode = 2;
    } catch (error) {
      console.error('Could not inspect Builder migration status: ' + error.message);
      process.exitCode = 1;
    } finally {
      await pool.end();
    }
  }
}
