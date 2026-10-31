import test from 'node:test';
import assert from 'node:assert/strict';
import { createConnection } from 'node:net';
import { once } from 'node:events';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createBuildWorkerServer } from './build-worker.js';

async function startWorker(t, buildImpl) {
  const directory = await mkdtemp(join(tmpdir(), '4ndev-worker-server-test-'));
  const socketPath = join(directory, 'worker.sock');
  const server = createBuildWorkerServer({ socketPath, buildImpl });
  await once(server, 'listening');

  t.after(async () => {
    await new Promise(resolve => server.close(resolve));
    await rm(directory, { recursive: true, force: true });
  });

  return socketPath;
}

function request(socketPath, payload) {
  return new Promise((resolve, reject) => {
    const socket = createConnection(socketPath);
    let response = '';
    socket.setEncoding('utf8');
    socket.on('data', chunk => { response += chunk; });
    socket.once('error', reject);
    socket.once('end', () => resolve(response));
    socket.once('connect', () => socket.end(payload));
  });
}

test('rejects oversized worker requests without invoking the build implementation', async t => {
  let buildCalls = 0;
  const socketPath = await startWorker(t, async () => {
    buildCalls += 1;
    return { success: true };
  });

  const response = await request(socketPath, 'x'.repeat(1_100_001));

  assert.deepEqual(JSON.parse(response), {
    success: false,
    error: 'Build request exceeds size limits.'
  });
  assert.equal(buildCalls, 0);
});

test('processes one valid request once and returns the build result', async t => {
  let buildCalls = 0;
  const socketPath = await startWorker(t, async files => {
    buildCalls += 1;
    assert.deepEqual(files, [{ path: 'index.html', content: '<main>ok</main>' }]);
    return { success: true, log: 'built' };
  });

  const response = await request(socketPath, JSON.stringify({
    files: [{ path: 'index.html', content: '<main>ok</main>' }]
  }));

  assert.deepEqual(JSON.parse(response), { success: true, log: 'built' });
  assert.equal(buildCalls, 1);
});
