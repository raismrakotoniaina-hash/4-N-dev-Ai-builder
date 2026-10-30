import test from 'node:test';
import assert from 'node:assert/strict';
import { runMigrations } from './migrate.js';

test('applies Builder migrations transactionally and records applied names', async () => {
  const applied = new Set();
  const executed = [];
  const pool = {
    async query(sql, params = []) {
      executed.push(sql.trim());
      if (sql.includes('SELECT name FROM builder_schema_migrations')) {
        return { rows: [...applied].map((name) => ({ name })) };
      }
      if (sql.includes('INSERT INTO builder_schema_migrations')) applied.add(params[0]);
      return { rows: [] };
    },
    async connect() {
      return {
        async query(sql, params = []) {
          executed.push(sql.trim());
          if (sql.includes('INSERT INTO builder_schema_migrations')) applied.add(params[0]);
          return { rows: [] };
        },
        release() {}
      };
    }
  };
  const first = await runMigrations(pool);
  assert.deepEqual(first, ['001_initial_builder_schema.sql', '002_builder_billing_credits.sql', '003_builder_billing_durations.sql']);
  assert.ok(executed.some((sql) => sql.includes('CREATE TABLE IF NOT EXISTS builder_users')));
  assert.ok(executed.some((sql) => sql.includes('CREATE TABLE IF NOT EXISTS builder_project_files')));
  assert.ok(executed.some((sql) => sql.includes('CREATE TABLE IF NOT EXISTS builder_subscriptions')));
  assert.ok(executed.some((sql) => sql.includes('CREATE TABLE IF NOT EXISTS builder_credit_ledger')));
  assert.ok(executed.some((sql) => sql.includes("WHEN billing_interval = 'monthly' THEN '1_month'")));
  assert.ok(executed.some((sql) => sql === 'BEGIN'));
  assert.ok(executed.some((sql) => sql === 'COMMIT'));
  const second = await runMigrations(pool);
  assert.deepEqual(second, []);
});
