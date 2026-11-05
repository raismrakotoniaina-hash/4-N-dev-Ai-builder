import test from 'node:test';
import assert from 'node:assert/strict';
import { inspectMigrationStatus } from './migration-status.js';

test('reports pending migrations without creating the schema tracking table', async () => {
  const calls = [];
  const pool = { async query(sql) {
    calls.push(sql);
    if (sql.includes('to_regclass')) return { rows: [{ table_name: null }] };
    throw new Error('status checker must not query applied migrations when table is absent');
  }};
  const status = await inspectMigrationStatus(pool);
  assert.equal(status.applied.length, 0);
  assert.deepEqual(status.pending, [
    '001_initial_builder_schema.sql',
    '002_builder_billing_credits.sql',
    '003_builder_billing_durations.sql',
    '004_builder_dual_credit_pools.sql',
    '005_builder_generation_reservations_and_core_usage.sql',
    '006_builder_one_time_free_core_generation.sql',
    '007_builder_billing_constraint_cleanup.sql'
  ]);
  assert.deepEqual(status.unknown, []);
  assert.equal(calls.length, 1);
  assert.match(calls[0], /to_regclass/);
});

test('reports pending and unknown migrations using a read-only query', async () => {
  const pool = { async query(sql) {
    if (sql.includes('to_regclass')) return { rows: [{ table_name: 'builder_schema_migrations' }] };
    return { rows: [{ name: '001_initial_builder_schema.sql' }, { name: '999_removed_migration.sql' }] };
  }};
  const status = await inspectMigrationStatus(pool);
  assert.deepEqual(status.applied, ['001_initial_builder_schema.sql', '999_removed_migration.sql']);
  assert.deepEqual(status.pending, [
    '002_builder_billing_credits.sql',
    '003_builder_billing_durations.sql',
    '004_builder_dual_credit_pools.sql',
    '005_builder_generation_reservations_and_core_usage.sql',
    '006_builder_one_time_free_core_generation.sql',
    '007_builder_billing_constraint_cleanup.sql'
  ]);
  assert.deepEqual(status.unknown, ['999_removed_migration.sql']);
});
