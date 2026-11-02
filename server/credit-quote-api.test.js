import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createBuilderServer } from './index.js';
import { createPersistence } from './persistence.js';

async function setup(t, { builderCreditsChargingEnabled = false, coreApiKey = null } = {}) {
  const directory = await mkdtemp(join(tmpdir(), '4n-builder-credit-quote-'));
  const store = createPersistence({
    filePath: join(directory, 'state.json'),
    encryptionKey: 'test-encryption-key-that-is-at-least-32-bytes'
  });
  const server = createBuilderServer({ store, builderCreditsChargingEnabled, coreApiKey });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  t.after(async () => {
    await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    await rm(directory, { recursive: true, force: true });
  });
  const base = 'http://127.0.0.1:' + server.address().port;
  const auth = await fetch(base + '/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'quote@example.test', password: 'a-long-test-password-123' })
  });
  assert.equal(auth.status, 201);
  const cookie = auth.headers.get('set-cookie').split(';')[0];
  const user = await store.getUserForSession(cookie.split('=')[1]);
  const periodStart = new Date();
  const periodEnd = new Date(periodStart);
  periodEnd.setUTCFullYear(periodEnd.getUTCFullYear() + 1);
  await store.recordSubscription({
    userId: user.id, plan: 'pro', billingInterval: '12_months',
    status: 'active', periodStart, periodEnd
  });
  const created = await fetch(base + '/api/projects', {
    method: 'POST',
    headers: { Cookie: cookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Quote test project' })
  });
  assert.equal(created.status, 201);
  const project = (await created.json()).project;
  return { base, cookie, project };
}

async function requestQuote(context) {
  return fetch(context.base + '/api/projects/' + context.project.id + '/credit-quote', {
    method: 'POST',
    headers: { Cookie: context.cookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt: 'Create a booking web application' })
  });
}

test('credit quote reports estimate-only when Builder charging is disabled', async t => {
  const context = await setup(t);
  const response = await requestQuote(context);
  assert.equal(response.status, 200);
  const { quote } = await response.json();
  assert.equal(quote.chargeEnabled, false);
  assert.match(quote.message, /No Builder Credits are reserved or charged/);
});

test('credit quote reports charging enabled only with the platform Core key', async t => {
  const context = await setup(t, {
    builderCreditsChargingEnabled: true,
    coreApiKey: '4ndev_sk_platform_test_key_0123456789'
  });
  const response = await requestQuote(context);
  assert.equal(response.status, 200);
  const { quote } = await response.json();
  assert.equal(quote.chargeEnabled, true);
  assert.match(quote.message, /reserved only after you confirm generation/);
});

test('credit quote refuses charging mode without a platform Core key', async t => {
  const context = await setup(t, { builderCreditsChargingEnabled: true, coreApiKey: null });
  const response = await requestQuote(context);
  assert.equal(response.status, 503);
  assert.match((await response.json()).error, /platform Core key is not configured/);
});
