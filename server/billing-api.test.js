import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createBuilderServer } from './index.js';
import { createPersistence } from './persistence.js';

test('billing endpoint is authenticated and returns server-owned prices and Free state', async (t) => {
  const directory = await mkdtemp(join(tmpdir(), '4n-builder-billing-test-'));
  const store = createPersistence({
    filePath: join(directory, 'state.json'),
    encryptionKey: 'test-encryption-key-that-is-at-least-32-bytes'
  });
  const server = createBuilderServer({ store });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  t.after(async () => {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    await rm(directory, { recursive: true, force: true });
  });

  const unauthorized = await fetch(`${baseUrl}/api/billing`);
  assert.equal(unauthorized.status, 401);

  const registered = await fetch(`${baseUrl}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'billing@example.test', password: 'a-long-test-password-123' })
  });
  assert.equal(registered.status, 201);
  const cookie = registered.headers.get('set-cookie')?.split(';')[0];
  const response = await fetch(`${baseUrl}/api/billing`, { headers: { Cookie: cookie } });
  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.equal(payload.billing.subscription.plan, 'free');
  assert.equal(payload.billing.creditsBalance, 0);
  assert.equal(payload.billing.paymentsEnabled, false);
  assert.equal(payload.billing.renewalEnabled, false);
  assert.deepEqual(payload.billing.creditsPolicy, {
    monthlyGrantEnabled: false,
    monthlyExpiryEnabled: false,
    rolloverEnabled: false,
    status: 'not_enabled'
  });
  assert.equal(payload.billing.plans.find((plan) => plan.id === 'starter').pricesUsdCents.yearly, 10800);
  assert.equal(payload.billing.plans.find((plan) => plan.id === 'business').monthlyCredits, 400);
});
