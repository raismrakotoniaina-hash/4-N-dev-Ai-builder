import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createBuilderServer } from './index.js';
import { createPersistence } from './persistence.js';

const API_KEY = '4ndev_sk_0123456789abcdefghijkl';
const goodFiles = [
  { path: 'package.json', content: '{"scripts":{"build":"vite build"}}' },
  { path: 'src/App.tsx', content: 'export default function App(){return <main>OK</main>}' }
];
function coreResponse(service, model) {
  const data = service === 'chat' ? { message: { content: 'A responsive app with clear pages and validation.' } } : { output: JSON.stringify({ files: goodFiles }) };
  return new Response(JSON.stringify({ success: true, service, model, data, usage: { charged_usd: 0.01, currency: 'USD' } }), { status: 200 });
}
async function setup(t, fetchImpl, buildValidator = async () => ({ success: true }), coreApiKey, plan = 'starter', builderCreditsChargingEnabled = false) {
  const dir = await mkdtemp(join(tmpdir(), '4n-generation-core-billing-'));
  const store = createPersistence({ filePath: join(dir, 'state.json'), encryptionKey: 'test-encryption-key-that-is-at-least-32-bytes' });
  const server = createBuilderServer({ store, fetchImpl, buildValidator, coreApiKey, builderCreditsChargingEnabled });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  t.after(async () => { await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve())); await rm(dir, { recursive: true, force: true }); });
  const base = 'http://127.0.0.1:' + server.address().port;
  const auth = await fetch(base + '/api/auth/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'test@example.test', password: 'a-long-test-password-123' }) });
  assert.equal(auth.status, 201);
  const cookie = auth.headers.get('set-cookie').split(';')[0];
  const user = await store.getUserForSession(cookie.split('=')[1]);
  if (plan !== 'free') {
    const periodStart = new Date();
    const periodEnd = new Date(periodStart);
    periodEnd.setUTCFullYear(periodEnd.getUTCFullYear() + 1);
    await store.recordSubscription({ userId: user.id, plan, billingInterval: '12_months', status: 'active', periodStart, periodEnd });
  }
  await store.connectCoreKey(user.id, API_KEY);
  const created = await fetch(base + '/api/projects', { method: 'POST', headers: { Cookie: cookie, 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'Test app' }) });
  return { base, cookie, store, user, project: (await created.json()).project };
}
test('generation uses four server-selected Core models and saves validated files without Builder ledger calls', async t => {
  const calls = [];
  const { base, cookie, project, store, user } = await setup(t, async (url, options) => {
    const body = JSON.parse(options.body); calls.push({ url, body, auth: options.headers.Authorization });
    return coreResponse(url.endsWith('/v1/chat') ? 'chat' : 'coding', body.model);
  });
  const response = await fetch(base + '/api/projects/' + project.id + '/generate', { method: 'POST', headers: { Cookie: cookie, 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt: 'Create a reservation app' }) });
  const result = await response.json();
  assert.equal(response.status, 200, JSON.stringify(result));
  assert.deepEqual(calls.map(c => [c.url.split('/').pop(), c.body.model]), [['chat','4n-chat-naya-6'],['chat','4n-chat-naya-5.6'],['coding','4n-code-nael-6.1'],['coding','4n-code-nael-5.6']]);
  assert.ok(calls.every(c => c.auth === 'Bearer ' + API_KEY));
  assert.equal(result.project.files.length, 2);
  assert.equal(result.billingProvider, '4N DEV Core');
  assert.equal(result.creditsCharged, 0);
  assert.equal((await store.getProject(user.id, project.id)).files.length, 2);
});
test('Free accounts receive one lifetime Core generation across all projects', async t => {
  let coreCalls = 0;
  const { base, cookie, project, store, user } = await setup(t, async (url, options) => {
    coreCalls++;
    return coreResponse(url.endsWith('/v1/chat') ? 'chat' : 'coding', JSON.parse(options.body).model);
  }, undefined, undefined, 'free');
  const first = await fetch(base + '/api/projects/' + project.id + '/generate', {
    method: 'POST', headers: { Cookie: cookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt: 'Create a complete app' })
  });
  const firstResult = await first.json();
  assert.equal(first.status, 200, JSON.stringify(firstResult));
  assert.equal(firstResult.generationMode, 'free_once');
  assert.equal(firstResult.billingProvider, '4N DEV Core');
  assert.equal(coreCalls, 4);

  const secondProjectResponse = await fetch(base + '/api/projects', {
    method: 'POST', headers: { Cookie: cookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Second project' })
  });
  const secondProject = (await secondProjectResponse.json()).project;
  const second = await fetch(base + '/api/projects/' + secondProject.id + '/generate', {
    method: 'POST', headers: { Cookie: cookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt: 'Create another app' })
  });
  assert.equal(second.status, 403);
  assert.match((await second.json()).error, /one-time free 4N Core generation/i);
  assert.equal(coreCalls, 4);

  const billingResponse = await fetch(base + '/api/billing', { headers: { Cookie: cookie } });
  const billing = await billingResponse.json();
  assert.equal(billing.billing.freeGeneration.status, 'used');
  assert.equal(billing.billing.freeGeneration.projectId, project.id);
  assert.equal((await store.getFreeGenerationStatus(user.id)).status, 'used');
});

test('a failed free Core generation releases the one-time claim for retry', async t => {
  let buildCalls = 0;
  let coreCalls = 0;
  const { base, cookie, project, store, user } = await setup(t, async (url, options) => {
    coreCalls++;
    return coreResponse(url.endsWith('/v1/chat') ? 'chat' : 'coding', JSON.parse(options.body).model);
  }, async () => {
    buildCalls++;
    if (buildCalls === 1) { const error = new Error('Vite build failed.'); error.statusCode = 422; throw error; }
    return { success: true };
  }, undefined, 'free');
  const request = () => fetch(base + '/api/projects/' + project.id + '/generate', {
    method: 'POST', headers: { Cookie: cookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt: 'Create an app' })
  });
  const failed = await request();
  assert.equal(failed.status, 422);
  assert.equal((await store.getFreeGenerationStatus(user.id)).status, 'available');
  const retry = await request();
  const result = await retry.json();
  assert.equal(retry.status, 200, JSON.stringify(result));
  assert.equal(result.generationMode, 'free_once');
  assert.equal(buildCalls, 2);
  assert.equal(coreCalls, 8);
  assert.equal((await store.getFreeGenerationStatus(user.id)).status, 'used');
});

test('does not save generated files when isolated build validation fails', async t => {
  const { base, cookie, project, store, user } = await setup(t, async url => coreResponse(url.endsWith('/v1/chat') ? 'chat' : 'coding', 'mock-model'), async () => { const e = new Error('Vite build failed.'); e.statusCode = 422; throw e; });
  const response = await fetch(base + '/api/projects/' + project.id + '/generate', { method: 'POST', headers: { Cookie: cookie, 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt: 'Create an app' }) });
  assert.equal(response.status, 422);
  assert.match((await response.json()).error, /Vite build failed/);
  assert.equal((await store.getProject(user.id, project.id)).files.length, 0);
});
test('ignores user-selected model overrides', async t => {
  const calls = [];
  const { base, cookie, project } = await setup(t, async (url, options) => { const body = JSON.parse(options.body); calls.push(body); return coreResponse(url.endsWith('/v1/chat') ? 'chat' : 'coding', body.model); });
  const response = await fetch(base + '/api/projects/' + project.id + '/generate', { method: 'POST', headers: { Cookie: cookie, 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt: 'Create an app', model: 'gpt-evil-model' }) });
  assert.equal(response.status, 200);
  assert.ok(calls.every(c => c.model !== 'gpt-evil-model'));
});
test('surfaces Core credit errors directly', async t => {
  const { base, cookie, project } = await setup(t, async () => new Response(JSON.stringify({ success: false, error: 'Insufficient Core credits.' }), { status: 402 }));
  const response = await fetch(base + '/api/projects/' + project.id + '/generate', { method: 'POST', headers: { Cookie: cookie, 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt: 'Create an app' }) });
  assert.equal(response.status, 402);
  assert.match((await response.json()).error, /Insufficient Core credits/);
});
test('requires a connected Core key when no server key is configured', async t => {
  const dir = await mkdtemp(join(tmpdir(), '4n-generation-no-key-'));
  const store = createPersistence({ filePath: join(dir, 'state.json'), encryptionKey: 'test-encryption-key-that-is-at-least-32-bytes' });
  const server = createBuilderServer({ store, fetchImpl: async () => { throw new Error('Should not call Core'); } });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  t.after(async () => { await new Promise(resolve => server.close(resolve)); await rm(dir, { recursive: true, force: true }); });
  const base = 'http://127.0.0.1:' + server.address().port;
  const auth = await fetch(base + '/api/auth/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'nokey@example.test', password: 'a-long-test-password-123' }) });
  const cookie = auth.headers.get('set-cookie').split(';')[0];
  const user = await store.getUserForSession(cookie.split('=')[1]);
  const periodStart = new Date();
  const periodEnd = new Date(periodStart); periodEnd.setUTCFullYear(periodEnd.getUTCFullYear() + 1);
  await store.recordSubscription({ userId: user.id, plan: 'starter', billingInterval: '12_months', status: 'active', periodStart, periodEnd });
  const p = await fetch(base + '/api/projects', { method: 'POST', headers: { Cookie: cookie, 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'No key project' }) });
  const project = (await p.json()).project;
  const response = await fetch(base + '/api/projects/' + project.id + '/generate', { method: 'POST', headers: { Cookie: cookie, 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt: 'Build an app' }) });
  assert.equal(response.status, 503);
  assert.match((await response.json()).error, /Connect a 4N DEV Core key/);
});

test('Builder Credits reserve and settle only after a successful build when explicitly enabled', async t => {
  const { base, cookie, project, store, user } = await setup(t, async (url, options) => coreResponse(url.endsWith('/v1/chat') ? 'chat' : 'coding', JSON.parse(options.body).model), undefined, API_KEY, 'starter', true);
  await store.grantCredits({ userId: user.id, amount: 40, idempotencyKey: 'seed-generation-success', reason: 'test grant' });
  const response = await fetch(base + '/api/projects/' + project.id + '/generate', { method: 'POST', headers: { Cookie: cookie, 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt: 'Create a reservation app' }) });
  const result = await response.json();
  assert.equal(response.status, 200, JSON.stringify(result));
  assert.equal(result.creditsCharged, 24);
  assert.equal((await store.getBillingState(user.id)).builderCreditsBalance, 16);
});

test('Builder Credits are refunded exactly once when isolated build validation fails', async t => {
  const { base, cookie, project, store, user } = await setup(t, async url => coreResponse(url.endsWith('/v1/chat') ? 'chat' : 'coding', 'mock-model'), async () => { const e = new Error('Vite build failed.'); e.statusCode = 422; throw e; }, API_KEY, 'starter', true);
  await store.grantCredits({ userId: user.id, amount: 40, idempotencyKey: 'seed-generation-refund', reason: 'test grant' });
  const response = await fetch(base + '/api/projects/' + project.id + '/generate', { method: 'POST', headers: { Cookie: cookie, 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt: 'Create a reservation app' }) });
  assert.equal(response.status, 422);
  assert.equal((await response.json()).refundPending, false);
  assert.equal((await store.getBillingState(user.id)).builderCreditsBalance, 40);
});

test('Builder Credits prevent Core calls when the reserved balance is insufficient', async t => {
  let calls = 0;
  const { base, cookie, project, store, user } = await setup(t, async () => { calls++; return coreResponse('chat', 'mock-model'); }, undefined, API_KEY, 'starter', true);
  await store.grantCredits({ userId: user.id, amount: 2, idempotencyKey: 'seed-generation-insufficient', reason: 'test grant' });
  const response = await fetch(base + '/api/projects/' + project.id + '/generate', { method: 'POST', headers: { Cookie: cookie, 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt: 'Create a reservation app' }) });
  assert.equal(response.status, 402);
  assert.equal(calls, 0);
  assert.equal((await store.getBillingState(user.id)).builderCreditsBalance, 2);
});

test('Builder Credits mode refuses customer Core-key billing when no platform key exists', async t => {
  const { base, cookie, project } = await setup(t, async () => { throw new Error('Core must not be called.'); }, undefined, undefined, 'starter', true);
  const response = await fetch(base + '/api/projects/' + project.id + '/generate', { method: 'POST', headers: { Cookie: cookie, 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt: 'Create a reservation app' }) });
  assert.equal(response.status, 503);
  assert.match((await response.json()).error, /platform Core key/i);
});
