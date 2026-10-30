import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createPersistence } from './persistence.js';

test('credit ledger grants and charges idempotently and never permits a negative balance', async (t) => {
  const directory = await mkdtemp(join(tmpdir(), '4n-builder-ledger-test-'));
  const store = createPersistence({
    filePath: join(directory, 'state.json'),
    encryptionKey: 'test-encryption-key-that-is-at-least-32-bytes'
  });
  t.after(() => rm(directory, { recursive: true, force: true }));
  const user = await store.createUser({ email: 'ledger@example.test', password: 'a-long-test-password-123' });

  assert.deepEqual(await store.getBillingState(user.id).then((state) => state.creditsBalance), 0);
  await store.recordSubscription({
    userId: user.id, plan: 'starter', billingInterval: '12_months', status: 'active',
    periodStart: '2026-10-01T00:00:00.000Z', periodEnd: '2027-10-01T00:00:00.000Z'
  });
  const subscribed = await store.getBillingState(user.id);
  assert.equal(subscribed.subscription.plan, 'starter');
  assert.equal(subscribed.subscription.priceUsdCents, 10800);
  assert.equal(subscribed.subscription.billingInterval, '12_months');
  assert.deepEqual(await store.grantCredits({
    userId: user.id, amount: 50, idempotencyKey: 'grant:period-1', reason: 'monthly test grant'
  }), { balance: 50, duplicate: false });
  assert.deepEqual(await store.grantCredits({
    userId: user.id, amount: 50, idempotencyKey: 'grant:period-1', reason: 'retry monthly test grant'
  }), { balance: 50, duplicate: true });
  assert.deepEqual(await store.consumeCredits({
    userId: user.id, amount: 15, idempotencyKey: 'job:abc', reason: 'test generation'
  }), { balance: 35, duplicate: false });
  assert.deepEqual(await store.consumeCredits({
    userId: user.id, amount: 15, idempotencyKey: 'job:abc', reason: 'duplicate retry'
  }), { balance: 35, duplicate: true });
  await assert.rejects(
    store.consumeCredits({ userId: user.id, amount: 36, idempotencyKey: 'job:too-many', reason: 'overspend test' }),
    (error) => error.code === 'INSUFFICIENT_CREDITS'
  );
  assert.equal((await store.getBillingState(user.id)).creditsBalance, 35);
});
