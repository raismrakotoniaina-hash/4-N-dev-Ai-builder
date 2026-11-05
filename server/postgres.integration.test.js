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
    '005_builder_generation_reservations_and_core_usage.sql',
    '006_builder_one_time_free_core_generation.sql',
    '007_builder_billing_constraint_cleanup.sql'
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

  const freeAttempts = await Promise.all([
    store.reserveFreeGeneration({ userId, projectId, jobId: 'free-generation-a' }),
    store.reserveFreeGeneration({ userId, projectId, jobId: 'free-generation-b' })
  ]);
  assert.equal(freeAttempts.filter(item => item.status === 'reserved').length, 1);
  assert.equal(freeAttempts.filter(item => item.status === 'processing').length, 1);
  const freeJob = freeAttempts[0].status === 'reserved' ? 'free-generation-a' : 'free-generation-b';
  const freeFiles = [{ path: 'package.json', content: '{"scripts":{"build":"vite build"}}' }];
  assert.ok(await store.putFilesAndCompleteFreeGeneration({ userId, projectId, files: freeFiles, jobId: freeJob }));
  assert.equal((await store.getFreeGenerationStatus(userId)).status, 'used');
  assert.equal((await store.reserveFreeGeneration({ userId, projectId, jobId: 'free-generation-c' })).status, 'used');

  const retryUserId = randomUUID();
  const retryProjectId = randomUUID();
  await pool.query(
    'INSERT INTO builder_users(id,email,password_salt,password_hash) VALUES($1,$2,$3,$4)',
    [retryUserId, retryUserId + '@integration.test', 'salt', 'hash']
  );
  await pool.query(
    'INSERT INTO builder_projects(id,user_id,name) VALUES($1,$2,$3)',
    [retryProjectId, retryUserId, 'Free retry project']
  );
  await store.reserveFreeGeneration({ userId: retryUserId, projectId: retryProjectId, jobId: 'free-retry-failed' });
  assert.equal((await store.releaseFreeGeneration({ userId: retryUserId, jobId: 'free-retry-failed' })).status, 'released');
  assert.equal((await store.getFreeGenerationStatus(retryUserId)).status, 'available');
  assert.equal((await store.reserveFreeGeneration({ userId: retryUserId, projectId: retryProjectId, jobId: 'free-retry-success' })).status, 'reserved');

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

test('PostgreSQL migration 007 removes legacy billing constraints and normalizes subscriptions', { skip: !enabled }, async t => {
  const admin = new Pool({ connectionString, max: 2 });
  const schema = 'builder_legacy_test_' + randomUUID().replaceAll('-', '');
  await admin.query('CREATE SCHEMA "' + schema + '"');

  const pool = new Pool({
    connectionString,
    max: 4,
    options: '-c search_path=' + schema
  });

  t.after(async () => {
    await pool.end();
    await admin.query('DROP SCHEMA IF EXISTS "' + schema + '" CASCADE');
    await admin.end();
  });

  for (const filename of [
    '001_initial_builder_schema.sql',
    '002_builder_billing_credits.sql'
  ]) {
    const sql = await readFile(new URL('./migrations/' + filename, import.meta.url), 'utf8');
    await pool.query(sql);
  }

  const userId = randomUUID();
  await pool.query(
    'INSERT INTO builder_users(id,email,password_salt,password_hash) VALUES($1,$2,$3,$4)',
    [userId, userId + '@legacy-test.integration', 'salt', 'hash']
  );

  const periodStart = new Date();
  const periodEnd = new Date(Date.now() + 30 * 86400000);

  for (const subscription of [
    { plan: 'starter', interval: 'monthly', price: 1200 },
    { plan: 'pro', interval: 'yearly', price: 22800 }
  ]) {
    await pool.query(
      `INSERT INTO builder_subscriptions
       (id,user_id,plan,billing_interval,status,price_usd_cents,period_start,period_end)
       VALUES($1,$2,$3,$4,'active',$5,$6,$7)`,
      [
        randomUUID(), userId, subscription.plan, subscription.interval,
        subscription.price, periodStart, periodEnd
      ]
    );
  }

  await pool.query(`
    ALTER TABLE builder_subscriptions
    ADD CONSTRAINT legacy_subscription_duration_guard
    CHECK (billing_interval IN ('monthly', 'yearly'))
  `);

  const cleanupSql = await readFile(
    new URL('./migrations/007_builder_billing_constraint_cleanup.sql', import.meta.url),
    'utf8'
  );
  await pool.query(cleanupSql);

  const allConstraints = await pool.query(`
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'builder_subscriptions'::regclass
  `);
  const constraintNames = new Set(allConstraints.rows.map(row => row.conname));

  assert.equal(
    constraintNames.has('builder_subscriptions_check1'),
    false,
    'Legacy plan-duration-price constraint must be removed'
  );

  for (const name of [
    'builder_subscriptions_plan_check',
    'builder_subscriptions_currency_check',
    'builder_subscriptions_status_check',
    'builder_subscriptions_price_usd_cents_check',
    'builder_subscriptions_pkey',
    'builder_subscriptions_user_id_fkey'
  ]) {
    assert.ok(
      constraintNames.has(name),
      `Required subscription constraint must remain: ${name}`
    );
  }

  const subscriptions = await pool.query(
    'SELECT billing_interval FROM builder_subscriptions WHERE user_id=$1 ORDER BY billing_interval',
    [userId]
  );
  assert.deepEqual(
    subscriptions.rows.map(row => row.billing_interval),
    ['12_months', '1_month']
  );

  const constraints = await pool.query(`
    SELECT conname, pg_get_constraintdef(oid) AS definition
    FROM pg_constraint
    WHERE conrelid = 'builder_subscriptions'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%billing_interval%'
    ORDER BY conname
  `);

  assert.deepEqual(
    constraints.rows.map(row => row.conname),
    [
      'builder_subscriptions_billing_interval_check',
      'builder_subscriptions_duration_price_check'
    ]
  );
  assert.ok(constraints.rows.every(row =>
    !/monthly|yearly/i.test(row.definition)
  ));

  await pool.query(
    `INSERT INTO builder_subscriptions
     (id,user_id,plan,billing_interval,status,price_usd_cents,period_start,period_end)
     VALUES($1,$2,'starter','3_months','active',3420,$3,$4)`,
    [randomUUID(), userId, periodStart, periodEnd]
  );

  await assert.rejects(
    pool.query(
      `INSERT INTO builder_subscriptions
       (id,user_id,plan,billing_interval,status,price_usd_cents,period_start,period_end)
       VALUES($1,$2,'starter','monthly','active',1200,$3,$4)`,
      [randomUUID(), userId, periodStart, periodEnd]
    )
  );

  await assert.rejects(
    pool.query(
      `INSERT INTO builder_subscriptions
       (id,user_id,plan,billing_interval,status,price_usd_cents,period_start,period_end)
       VALUES($1,$2,'starter','1_month','active',9999,$3,$4)`,
      [randomUUID(), userId, periodStart, periodEnd]
    )
  );

  await assert.rejects(
    pool.query(
      `INSERT INTO builder_subscriptions
       (id,user_id,plan,billing_interval,status,price_usd_cents,period_start,period_end)
       VALUES($1,$2,'unknown','1_month','active',0,$3,$4)`,
      [randomUUID(), userId, periodStart, periodEnd]
    )
  );

  await assert.rejects(
    pool.query(
      `INSERT INTO builder_subscriptions
       (id,user_id,plan,billing_interval,status,price_usd_cents,currency,period_start,period_end)
       VALUES($1,$2,'starter','1_month','active',1200,'EUR',$3,$4)`,
      [randomUUID(), userId, periodStart, periodEnd]
    )
  );
});
