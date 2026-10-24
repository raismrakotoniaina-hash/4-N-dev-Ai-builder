import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createBuilderServer } from './index.js';
import { createPersistence } from './persistence.js';

async function withServer(t, options = {}) {
  const directory = await mkdtemp(join(tmpdir(), '4n-builder-test-'));
  const store = createPersistence({
    filePath: join(directory, 'state.json'),
    encryptionKey: 'test-encryption-key-that-is-at-least-32-bytes'
  });
  const server = createBuilderServer({ store, ...options });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  t.after(async () => {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    await rm(directory, { recursive: true, force: true });
  });
  return { baseUrl: `http://127.0.0.1:${server.address().port}`, store };
}

async function register(baseUrl, email = 'owner@example.test') {
  const response = await fetch(`${baseUrl}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: 'a-long-test-password-123' })
  });
  const cookie = response.headers.get('set-cookie')?.split(';')[0];
  return { response, cookie };
}

test('registers accounts and protects private routes with an HttpOnly session', async (t) => {
  const { baseUrl } = await withServer(t);
  const { response, cookie } = await register(baseUrl);
  assert.equal(response.status, 201);
  assert.match(response.headers.get('set-cookie'), /HttpOnly/);
  assert.match(response.headers.get('set-cookie'), /SameSite=Lax/);
  assert.ok(cookie);
  assert.equal((await (await fetch(`${baseUrl}/api/projects`)).json()).error, 'Authentication required.');
  const me = await fetch(`${baseUrl}/api/auth/me`, { headers: { Cookie: cookie } });
  assert.equal(me.status, 200);
  assert.equal((await me.json()).user.email, 'owner@example.test');
});

test('rejects duplicate accounts and wrong passwords', async (t) => {
  const { baseUrl } = await withServer(t);
  await register(baseUrl);
  const duplicate = await register(baseUrl);
  assert.equal(duplicate.response.status, 409);
  const login = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'owner@example.test', password: 'wrong-password' })
  });
  assert.equal(login.status, 401);
});

test('projects and files persist and are isolated by account', async (t) => {
  const { baseUrl } = await withServer(t);
  const first = await register(baseUrl, 'first@example.test');
  const second = await register(baseUrl, 'second@example.test');
  const created = await fetch(`${baseUrl}/api/projects`, {
    method: 'POST', headers: { Cookie: first.cookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Demo app', description: 'Persistent project' })
  });
  assert.equal(created.status, 201);
  const project = (await created.json()).project;
  const file = await fetch(`${baseUrl}/api/projects/${project.id}/files`, {
    method: 'PUT', headers: { Cookie: first.cookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({ path: 'src/main.ts', content: 'export const ok = true;' })
  });
  assert.equal(file.status, 200);
  const reloaded = await fetch(`${baseUrl}/api/projects/${project.id}`, { headers: { Cookie: first.cookie } });
  assert.equal((await reloaded.json()).project.files[0].content, 'export const ok = true;');
  const crossAccount = await fetch(`${baseUrl}/api/projects/${project.id}`, { headers: { Cookie: second.cookie } });
  assert.equal(crossAccount.status, 404);
});

test('Core key is validated server-side, stored encrypted, and never returned', async (t) => {
  const { baseUrl, store } = await withServer(t, {
    fetchImpl: async (url, options) => {
      assert.equal(url, 'https://api.4ndev.dev/v1/credits');
      assert.match(options.headers.Authorization, /^Bearer 4ndev_sk_/);
      return new Response(JSON.stringify({ success: true, credits: 42 }), { status: 200 });
    }
  });
  const { cookie } = await register(baseUrl);
  const key = '4ndev_sk_0123456789abcdefghijkl';
  const response = await fetch(`${baseUrl}/api/core/connect`, {
    method: 'POST', headers: { Cookie: cookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({ apiKey: key })
  });
  assert.equal(response.status, 200);
  assert.equal(JSON.stringify(await response.json()).includes(key), false);
  assert.equal(await store.getCoreKey((await store.getUserForSession(cookie.split('=')[1])).id), key);
  const status = await fetch(`${baseUrl}/api/core/connection`, { headers: { Cookie: cookie } });
  assert.equal((await status.json()).connected, true);
});

test('rejects traversal paths and too-short passwords', async (t) => {
  const { baseUrl } = await withServer(t);
  const badPassword = await fetch(`${baseUrl}/api/auth/register`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'short@example.test', password: 'short' })
  });
  assert.equal(badPassword.status, 400);
  const { cookie } = await register(baseUrl);
  const projectResponse = await fetch(`${baseUrl}/api/projects`, {
    method: 'POST', headers: { Cookie: cookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Safe project' })
  });
  const project = (await projectResponse.json()).project;
  const fileResponse = await fetch(`${baseUrl}/api/projects/${project.id}/files`, {
    method: 'PUT', headers: { Cookie: cookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({ path: '../secret.txt', content: 'no' })
  });
  assert.equal(fileResponse.status, 400);
});
