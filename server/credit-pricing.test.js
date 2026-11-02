import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { estimateBuilderCredits } from './credit-pricing.js';
import { createBuilderServer } from './index.js';
import { createPersistence } from './persistence.js';

test('credit estimates vary by task type and complexity', () => {
  assert.equal(estimateBuilderCredits('Change the button color').totalCredits, 2);
  assert.equal(estimateBuilderCredits('Change the button color in my app').taskType, 'small_edit');
  assert.equal(estimateBuilderCredits('Refactor the app architecture').taskType, 'refactor');
  assert.equal(estimateBuilderCredits('Add a new settings page').totalCredits, 5);
  assert.equal(estimateBuilderCredits('Create a contact form with validation').totalCredits, 6);
  assert.equal(estimateBuilderCredits('Create a database API backend').totalCredits, 10);
  assert.equal(estimateBuilderCredits('Create a mobile app with several pages and Stripe payment integration').totalCredits, 39);
});

test('credit estimator rejects empty and oversized prompts', () => {
  assert.throws(() => estimateBuilderCredits(' '), /prompt between 1 and 12,000 characters/i);
  assert.throws(() => estimateBuilderCredits('x'.repeat(12001)), /prompt between 1 and 12,000 characters/i);
});

test('authenticated quote endpoint estimates without calling Core or changing balances', async (t) => {
  const directory = await mkdtemp(join(tmpdir(), '4n-builder-credit-quote-'));
  const store = createPersistence({
    filePath: join(directory, 'state.json'),
    encryptionKey: 'test-encryption-key-that-is-at-least-32-bytes'
  });
  const server = createBuilderServer({
    store,
    fetchImpl: async () => { throw new Error('Quote must not call Core.'); }
  });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  t.after(async () => {
    await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    await rm(directory, { recursive: true, force: true });
  });

  const base = 'http://127.0.0.1:' + server.address().port;
  const registered = await fetch(base + '/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'quote@example.test', password: 'a-long-test-password-123' })
  });
  const cookie = registered.headers.get('set-cookie').split(';')[0];
  const user = await store.getUserForSession(cookie.split('=')[1]);
  const periodStart = new Date();
  const periodEnd = new Date(periodStart);
  periodEnd.setUTCFullYear(periodEnd.getUTCFullYear() + 1);
  await store.recordSubscription({
    userId: user.id, plan: 'starter', billingInterval: '12_months',
    status: 'active', periodStart, periodEnd
  });
  const projectResponse = await fetch(base + '/api/projects', {
    method: 'POST',
    headers: { Cookie: cookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Quote test' })
  });
  const project = (await projectResponse.json()).project;

  const unauthorized = await fetch(base + '/api/projects/' + project.id + '/credit-quote', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt: 'Create a web app' })
  });
  assert.equal(unauthorized.status, 401);

  const response = await fetch(base + '/api/projects/' + project.id + '/credit-quote', {
    method: 'POST',
    headers: { Cookie: cookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt: 'Create a web app with multiple pages' })
  });
  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.equal(payload.quote.totalCredits, 28);
  assert.equal(payload.quote.chargeEnabled, false);
  assert.match(payload.quote.message, /No Builder Credits are reserved or charged/);
  const balances = await store.getBillingState(user.id);
  assert.equal(balances.builderCreditsBalance, 0);
  assert.equal(balances.runtimeCreditsBalance, 0);
});
