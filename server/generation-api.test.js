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
function response(service, model) {
  let data;
  if (service === 'chat') data = { message: { content: 'Responsive reservation dashboard plan' } };
  else data = { output: JSON.stringify({ files: goodFiles }) };
  return new Response(JSON.stringify({ success: true, service, model, data, usage: { charged_usd: 0.01, currency: 'USD' } }), { status: 200 });
}
async function setup(t, fetchImpl, buildValidator = async () => ({ success: true })) {
  const dir = await mkdtemp(join(tmpdir(), '4n-generation-'));
  const store = createPersistence({ filePath: join(dir, 'state.json'), encryptionKey: 'test-encryption-key-that-is-at-least-32-bytes' });
  const server = createBuilderServer({ store, fetchImpl, buildValidator });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  t.after(async () => {
    await new Promise((resolve, reject) => server.close((e) => e ? reject(e) : resolve()));
    await rm(dir, { recursive: true, force: true });
  });
  const base = 'http://127.0.0.1:' + server.address().port;
  const auth = await fetch(base + '/api/auth/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'test@example.test', password: 'a-long-test-password-123' }) });
  const cookie = auth.headers.get('set-cookie').split(';')[0];
  const user = await store.getUserForSession(cookie.split('=')[1]);
  await store.connectCoreKey(user.id, API_KEY);
  const p = await fetch(base + '/api/projects', { method: 'POST', headers: { Cookie: cookie, 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'Test app' }) });
  return { base, cookie, store, user, project: (await p.json()).project };
}
test('one user prompt invokes all four developer-selected Core models and saves files', async (t) => {
  const calls = [];
  const { base, cookie, project } = await setup(t, async (url, options) => {
    const body = JSON.parse(options.body);
    calls.push({ url, body, auth: options.headers.Authorization });
    return response(url.endsWith('/v1/chat') ? 'chat' : 'coding', body.model);
  });
  const r = await fetch(base + '/api/projects/' + project.id + '/generate', {
    method: 'POST', headers: { Cookie: cookie, 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt: 'Create a reservation app' })
  });
  const result = await r.json();
  assert.equal(r.status, 200);
  assert.deepEqual(calls.map((c) => [c.url.split('/').pop(), c.body.model]), [
    ['chat', '4n-chat-naya-6'],
    ['chat', '4n-chat-naya-5.6'],
    ['coding', '4n-code-nael-6.1'],
    ['coding', '4n-code-nael-5.6']
  ]);
  assert.ok(calls.every((c) => c.auth === 'Bearer ' + API_KEY));
  assert.match(calls[2].body.prompt, /exact versions and no ranges/);
  assert.match(calls[2].body.prompt, /react 19\.3\.0/);
  assert.match(calls[2].body.prompt, /vite 8\.3\.0/);
  assert.equal(result.project.files.length, 2);
  assert.equal(result.usage.charged_usd, 0.04);
});
test('does not accept a user-selected model', async (t) => {
  let calls = 0;
  const { base, cookie, project } = await setup(t, async (url, options) => {
    calls++;
    return response(url.endsWith('/v1/chat') ? 'chat' : 'coding', JSON.parse(options.body).model);
  });
  const r = await fetch(base + '/api/projects/' + project.id + '/generate', {
    method: 'POST', headers: { Cookie: cookie, 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt: 'Create an app', model: 'unapproved-model' })
  });
  assert.equal(r.status, 200);
  assert.equal(calls, 4);
});
test('rejects unsafe generated paths before writing any files', async (t) => {
  let codingCalls = 0;
  const { base, cookie, store, user, project } = await setup(t, async (url, options) => {
    const body = JSON.parse(options.body);
    if (url.endsWith('/v1/chat')) return response('chat', body.model);
    codingCalls++;
    const files = codingCalls === 1 ? goodFiles : [{ path: 'package.json', content: '{}' }, { path: '../bad', content: 'bad' }];
    return new Response(JSON.stringify({ success: true, data: { output: JSON.stringify({ files }) }, usage: { charged_usd: 0.01 } }), { status: 200 });
  });
  const r = await fetch(base + '/api/projects/' + project.id + '/generate', {
    method: 'POST', headers: { Cookie: cookie, 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt: 'Create an app' })
  });
  assert.equal(r.status, 502);
  assert.equal((await store.getProject(user.id, project.id)).files.length, 0);
});
