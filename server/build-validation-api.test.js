import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createBuilderServer } from './index.js';
import { createPersistence } from './persistence.js';

async function setup(t, buildValidator) {
  const dir = await mkdtemp(join(tmpdir(), '4n-build-validation-'));
  const store = createPersistence({ filePath: join(dir, 'state.json'), encryptionKey: 'test-encryption-key-that-is-at-least-32-bytes' });
  const server = createBuilderServer({ store, buildValidator });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  t.after(async () => {
    await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    await rm(dir, { recursive: true, force: true });
  });
  const base = 'http://127.0.0.1:' + server.address().port;
  const auth = await fetch(base + '/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'build@example.test', password: 'a-long-test-password-123' })
  });
  const cookie = auth.headers.get('set-cookie').split(';')[0];
  const user = await store.getUserForSession(cookie.split('=')[1]);
  const created = await store.createProject(user.id, { name: 'Editable app' });
  await store.putFiles(user.id, created.id, [
    { path: 'package.json', content: '{"scripts":{"build":"vite build"}}' },
    { path: 'index.html', content: '<div id="root"></div>' },
    { path: 'src/App.tsx', content: 'export default function App(){return <main>Updated</main>}' }
  ]);
  return { base, cookie, store, user, project: created };
}

test('validates saved source files and atomically replaces the preview only after success', async t => {
  const calls = [];
  const { base, cookie, store, user, project } = await setup(t, async files => {
    calls.push(files);
    return { success: true, log: 'vite build passed', previewHtml: '<html><body>new preview</body></html>' };
  });
  await store.putFile(user.id, project.id, { path: '__4ndev_preview.html', content: '<html>old preview</html>' });
  const response = await fetch(base + '/api/projects/' + project.id + '/validate', {
    method: 'POST', headers: { Cookie: cookie }
  });
  const result = await response.json();
  assert.equal(response.status, 200, JSON.stringify(result));
  assert.equal(calls.length, 1);
  assert.equal(calls[0].some(file => file.path === '__4ndev_preview.html'), false);
  assert.equal(result.previewAvailable, true);
  assert.match(result.log, /vite build passed/);
  const saved = await store.getProject(user.id, project.id);
  assert.equal(saved.files.find(file => file.path === '__4ndev_preview.html').content, '<html><body>new preview</body></html>');
});

test('failed validation preserves the last successful preview', async t => {
  const { base, cookie, store, user, project } = await setup(t, async () => {
    const error = new Error('Vite compilation failed.');
    error.statusCode = 422;
    throw error;
  });
  await store.putFile(user.id, project.id, { path: '__4ndev_preview.html', content: '<html>last good preview</html>' });
  const response = await fetch(base + '/api/projects/' + project.id + '/validate', {
    method: 'POST', headers: { Cookie: cookie }
  });
  assert.equal(response.status, 422);
  assert.match((await response.json()).error, /Vite compilation failed/);
  const saved = await store.getProject(user.id, project.id);
  assert.equal(saved.files.find(file => file.path === '__4ndev_preview.html').content, '<html>last good preview</html>');
});

test('requires authentication and project ownership', async t => {
  const { base, project } = await setup(t, async () => ({ success: true }));
  const unauthenticated = await fetch(base + '/api/projects/' + project.id + '/validate', { method: 'POST' });
  assert.equal(unauthenticated.status, 401);
  const missing = await fetch(base + '/api/projects/00000000-0000-4000-8000-000000000000/validate', {
    method: 'POST', headers: { Cookie: 'builder_session=invalid' }
  });
  assert.equal(missing.status, 401);
});
