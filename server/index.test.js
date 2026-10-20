import test from 'node:test';
import assert from 'node:assert/strict';
import { createBuilderServer } from './index.js';

const catalogue = {
  success: true,
  data: {
    models: [
      { id: '4n-chat-naya-5.6', status: 'active' },
      { id: '4n-chat-naya-6', status: 'active' },
      { id: '4n-code-nael-5.6', status: 'active' },
      { id: '4n-code-nael-6.1', status: 'active' }
    ]
  }
};

async function withServer(t, options = {}) {
  const server = createBuilderServer(options);
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  t.after(() => new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  }));
  const address = server.address();
  return `http://127.0.0.1:${address.port}`;
}

test('health endpoint reports the Builder backend without exposing secrets', async (t) => {
  const baseUrl = await withServer(t);
  const response = await fetch(`${baseUrl}/health`);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    success: true,
    service: '4N DEV AI Builder backend',
    status: 'online'
  });
});

test('model endpoint returns only the four canonical Core models', async (t) => {
  const baseUrl = await withServer(t, {
    fetchImpl: async () => new Response(JSON.stringify(catalogue), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    })
  });
  const response = await fetch(`${baseUrl}/api/models`);
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.success, true);
  assert.deepEqual(body.models.map((model) => model.id), [
    '4n-chat-naya-5.6',
    '4n-chat-naya-6',
    '4n-code-nael-5.6',
    '4n-code-nael-6.1'
  ]);
});

test('model endpoint fails closed when Core catalogue is incomplete', async (t) => {
  const baseUrl = await withServer(t, {
    fetchImpl: async () => new Response(JSON.stringify({
      success: true,
      data: { models: [{ id: '4n-chat-naya-5.6', status: 'active' }] }
    }), { status: 200 })
  });
  const response = await fetch(`${baseUrl}/api/models`);
  assert.equal(response.status, 503);
  assert.equal((await response.json()).success, false);
});

test('rejects browser origins that are not allowlisted', async (t) => {
  const baseUrl = await withServer(t, { allowedOrigins: new Set(['https://builder.example.test']) });
  const response = await fetch(`${baseUrl}/health`, {
    headers: { Origin: 'https://untrusted.example.test' }
  });
  assert.equal(response.status, 403);
});
