import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { runMigrations } from './migrate.js';
import { createPostgresPersistence } from './postgres-persistence.js';

const connectionString = process.env.DATABASE_URL;
const enabled = Boolean(connectionString);

test('PostgreSQL migrations, credit reservations, settlement/refund and Core metering', { skip: !enabled }, async t => {
  const admin = new Pool({ connectionString, max: 2 });
  const schema = 'builder_test_' + randomUUID().replaceAll('-', '');
  await admin.query('CREATE SCHEMA "' + schema + '"');
  const pool = new Pool({
    connectionString,
    max: 8,
    options: '-c search_path=' + schema
  });
  t.after(async () => {
    await pool.end();
    await admin.query('DROP SCHEMA IF EXISTS "' + schema + '" CASCADE');
    await admin.end();
  });

  const migrations = await runMigrations(pool);
  assert.deepEqual(migrations, [
    '001_initial_builder_schema.sql',
    '002_builder_billing_credits.sql',
    '003_builder_billing_durations.sql',
    '004_builder_dual_credit_pools.sql',
    '005_builder_generation_reservations_and_core_usage.sql'
  ]);
  assert.deepEqual(await runMigrations(pool), []);

  const userId = randomUUID();
  const projectId = randomUUID();
  await pool.query(
    'INSERT INTO builder_users(id,email,password_salt,password_hash) VALUES($1,$2,$3,$4)',
    [userId, userId + '@integration.test', 'salt', 'hash']
  );
  await pool.query(
    'INSERT INTO builder_projects(id,user_id,name) VALUES($1,$2,$3)',
    [projectId, userId, 'PostgreSQL integration project']
  );

  const store = createPostgresPersistence({
    pool,
    encryptionKey: 'test-encryption-key-that-is-at-least-32-bytes'
  });
  await store.grantCredits({
    userId, amount: 10, idempotencyKey: 'integration-grant-10', reason: 'integration test grant'
  });

  const attempts = await Promise.allSettled([1, 2].map(number =>
    store.reserveBuilderCredits({
      userId, amount: 7, idempotencyKey: 'integration-reserve-' + number,
      projectId, jobId: 'integration-job-' + number
    })
  ));
  assert.equal(attempts.filter(item => item.status === 'fulfilled').length, 1);
  assert.equal(attempts.filter(item => item.status === 'rejected' && item.reason.code === 'INSUFFICIENT_CREDITS').length, 1);
  assert.equal((await store.getBillingState(userId)).builderCreditsBalance, 3);

  const winningJob = attempts.find(item => item.status === 'fulfilled').value;
  assert.equal(winningJob.status, 'reserved');
  const reservations = await pool.query(
    "SELECT job_id FROM builder_credit_reservations WHERE user_id=$1 AND status='reserved'",
    [userId]
  );
  assert.equal(reservations.rowCount, 1);
  const jobId = reservations.rows[0].job_id;

  const terminal = await Promise.all([
    store.settleBuilderCreditReservation({ userId, jobId }),
    store.refundBuilderCreditReservation({ userId, jobId, reason: 'concurrent integration test' })
  ]);
  assert.ok(terminal.every(item => ['settled', 'refunded'].includes(item.status)));
  const finalReservation = await pool.query(
    'SELECT status FROM builder_credit_reservations WHERE user_id=$1 AND job_id=$2',
    [userId, jobId]
  );
  assert.ok(['settled', 'refunded'].includes(finalReservation.rows[0].status));
  const finalBalance = (await store.getBillingState(userId)).builderCreditsBalance;
  assert.ok(finalBalance === 3 || finalBalance === 10);

  const usage = {
    userId, projectId, jobId: 'core-usage-integration-job', stage: 'planner',
    model: '4n-chat-naya-6', chargedUsd: 0.0125,
    usage: { input_tokens: 10, output_tokens: 20 }
  };
  assert.equal((await store.recordCoreUsage(usage)).duplicate, false);
  assert.equal((await store.recordCoreUsage(usage)).duplicate, true);
  const rows = await pool.query('SELECT COUNT(*)::int AS count FROM builder_core_usage WHERE job_id=$1', [usage.jobId]);
  assert.equal(rows.rows[0].count, 1);
});
