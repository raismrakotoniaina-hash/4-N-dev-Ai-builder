import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createPersistence } from './persistence.js';

test('Builder credit reservation is idempotent and settles without a second debit', async t => {
  const dir = await mkdtemp(join(tmpdir(), '4n-builder-reservation-'));
  const store = createPersistence({ filePath: join(dir, 'state.json'), encryptionKey: 'test-encryption-key-that-is-at-least-32-bytes' });
  t.after(() => rm(dir, { recursive: true, force: true }));
  const user = await store.createUser({ email: 'reserve@example.test', password: 'a-long-test-password-123' });
  await store.grantCredits({ userId: user.id, amount: 50, idempotencyKey: 'grant-50', reason: 'test grant' });
  const input = { userId: user.id, amount: 12, idempotencyKey: 'job-1-reserve', projectId: null, jobId: 'job-1' };
  assert.equal((await store.reserveBuilderCredits(input)).balance, 38);
  assert.equal((await store.reserveBuilderCredits(input)).duplicate, true);
  assert.equal((await store.settleBuilderCreditReservation({ userId: user.id, jobId: 'job-1' })).status, 'settled');
  assert.equal((await store.refundBuilderCreditReservation({ userId: user.id, jobId: 'job-1' })).status, 'settled');
  assert.equal((await store.getBillingState(user.id)).builderCreditsBalance, 38);
});

test('Builder credit reservation refunds exactly once and restores the balance', async t => {
  const dir = await mkdtemp(join(tmpdir(), '4n-builder-refund-'));
  const store = createPersistence({ filePath: join(dir, 'state.json'), encryptionKey: 'test-encryption-key-that-is-at-least-32-bytes' });
  t.after(() => rm(dir, { recursive: true, force: true }));
  const user = await store.createUser({ email: 'refund@example.test', password: 'a-long-test-password-123' });
  await store.grantCredits({ userId: user.id, amount: 20, idempotencyKey: 'grant-20', reason: 'test grant' });
  await store.reserveBuilderCredits({ userId: user.id, amount: 7, idempotencyKey: 'job-2-reserve', jobId: 'job-2' });
  assert.equal((await store.refundBuilderCreditReservation({ userId: user.id, jobId: 'job-2' })).status, 'refunded');
  assert.equal((await store.refundBuilderCreditReservation({ userId: user.id, jobId: 'job-2' })).duplicate, true);
  assert.equal((await store.getBillingState(user.id)).builderCreditsBalance, 20);
});

test('concurrent Builder reservations cannot overspend the balance', async t => {
  const dir = await mkdtemp(join(tmpdir(), '4n-builder-concurrent-reserve-'));
  const store = createPersistence({ filePath: join(dir, 'state.json'), encryptionKey: 'test-encryption-key-that-is-at-least-32-bytes' });
  t.after(() => rm(dir, { recursive: true, force: true }));
  const user = await store.createUser({ email: 'concurrent@example.test', password: 'a-long-test-password-123' });
  await store.grantCredits({ userId: user.id, amount: 10, idempotencyKey: 'grant-10', reason: 'test grant' });
  const results = await Promise.allSettled([1, 2].map(n => store.reserveBuilderCredits({ userId: user.id, amount: 7, idempotencyKey: 'reserve-'+n, jobId: 'concurrent-'+n })));
  assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
  assert.equal((await store.getBillingState(user.id)).builderCreditsBalance, 3);
});
