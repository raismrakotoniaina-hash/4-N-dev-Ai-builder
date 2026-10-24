import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createBuildWorkerServer } from './build-worker.js';
import { validateBuild } from './build-worker-client.js';

const files = [
  { path: 'package.json', content: '{"scripts":{"build":"vite build"}}' },
  { path: 'index.html', content: '<div id="root"></div>' }
];

async function withWorker(t, buildImpl) {
  const dir = await mkdtemp(join(tmpdir(), '4ndev-worker-client-'));
  const socketPath = join(dir, 'worker.sock');
  const server = createBuildWorkerServer({ socketPath, buildImpl });
  await new Promise((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
  });
  t.after(async () => {
    await new Promise(resolve => server.close(resolve));
    await rm(dir, { recursive: true, force: true });
  });
  return socketPath;
}

test('client receives a successful isolated build result', async (t) => {
  const socketPath = await withWorker(t, async () => ({ success: true, log: 'built' }));
  const result = await validateBuild(files, { socketPath });
  assert.equal(result.success, true);
  assert.equal(result.log, 'built');
});

test('client reports build-worker validation failures as 422', async (t) => {
  const socketPath = await withWorker(t, async () => ({ success: false, error: 'TypeScript build failed.' }));
  await assert.rejects(validateBuild(files, { socketPath }), error => error.statusCode === 422 && /TypeScript build failed/.test(error.message));
});

test('client reports a missing worker as 503', async () => {
  await assert.rejects(validateBuild(files, { socketPath: '/tmp/4ndev-missing-worker.sock', timeoutMs: 500 }), error => error.statusCode === 503);
});
