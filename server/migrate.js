import { readdir, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const migrationsDirectory = join(here, 'migrations');

export async function runMigrations(pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS builder_schema_migrations (
      name TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  const files = (await readdir(migrationsDirectory)).filter((name) => /^\d+_[a-z0-9_-]+\.sql$/.test(name)).sort();
  const applied = new Set((await pool.query('SELECT name FROM builder_schema_migrations')).rows.map((row) => row.name));
  const results = [];
  for (const name of files) {
    if (applied.has(name)) continue;
    const sql = await readFile(join(migrationsDirectory, name), 'utf8');
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(sql);
      await client.query('INSERT INTO builder_schema_migrations(name) VALUES($1)', [name]);
      await client.query('COMMIT');
      results.push(name);
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {});
      throw new Error(`Migration ${name} failed: ${error.message}`);
    } finally {
      client.release();
    }
  }
  return results;
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
      const applied = await runMigrations(pool);
      console.log(applied.length ? 'Applied: ' + applied.join(', ') : 'Database schema is already up to date.');
    } catch (error) {
      console.error('Builder migration failed: ' + error.message);
      process.exitCode = 1;
    } finally {
      await pool.end();
    }
  }
}
