import test from 'node:test';
import assert from 'node:assert/strict';
import { createPostgresPersistence } from './postgres-persistence.js';

function makePool({ failOnInsert = 0 } = {}) {
  const queries = [];
  let inserts = 0;
  const client = {
    async query(sql, params = []) {
      const normalized = sql.trim();
      queries.push({ sql: normalized, params });
      if (normalized === 'SELECT id FROM builder_projects WHERE id=$1 AND user_id=$2 FOR UPDATE') {
        return { rowCount: 1, rows: [{ id: params[0] }] };
      }
      if (normalized.startsWith('INSERT INTO builder_project_files')) {
        inserts += 1;
        if (inserts === failOnInsert) throw new Error('simulated insert failure');
        return {
          rowCount: 1,
          rows: [{ path: params[1], content: params[2], updated_at: new Date('2026-01-01T00:00:00.000Z') }]
        };
      }
      return { rowCount: 1, rows: [] };
    },
    release() { queries.push({ sql: 'RELEASE', params: [] }); }
  };
  return {
    queries,
    pool: {
      async query() { return { rowCount: 0, rows: [] }; },
      async connect() { return client; }
    }
  };
}

const files = [
  { path: 'package.json', content: '{"scripts":{"build":"vite build"}}' },
  { path: 'src/App.tsx', content: 'export default function App() { return null; }' }
];

test('PostgreSQL putFiles saves all generated files in one transaction', async () => {
  const { pool, queries } = makePool();
  const store = createPostgresPersistence({ pool, encryptionKey: 'test-encryption-key-that-is-at-least-32-bytes' });

  const saved = await store.putFiles('user-1', 'project-1', files);

  assert.deepEqual(saved.map((file) => file.path), ['package.json', 'src/App.tsx']);
  assert.equal(queries.filter((item) => item.sql === 'BEGIN').length, 1);
  assert.equal(queries.filter((item) => item.sql === 'COMMIT').length, 1);
  assert.equal(queries.filter((item) => item.sql === 'ROLLBACK').length, 0);
});

test('PostgreSQL putFiles rolls back the entire file set when one insert fails', async () => {
  const { pool, queries } = makePool({ failOnInsert: 2 });
  const store = createPostgresPersistence({ pool, encryptionKey: 'test-encryption-key-that-is-at-least-32-bytes' });

  await assert.rejects(store.putFiles('user-1', 'project-1', files), /simulated insert failure/);

  assert.equal(queries.filter((item) => item.sql === 'BEGIN').length, 1);
  assert.equal(queries.filter((item) => item.sql === 'COMMIT').length, 0);
  assert.equal(queries.filter((item) => item.sql === 'ROLLBACK').length, 1);
});

test('PostgreSQL putFiles rejects duplicate paths before opening a transaction', async () => {
  const { pool, queries } = makePool();
  const store = createPostgresPersistence({ pool, encryptionKey: 'test-encryption-key-that-is-at-least-32-bytes' });

  await assert.rejects(
    store.putFiles('user-1', 'project-1', [files[0], files[0]]),
    /unique paths/
  );
  assert.equal(queries.length, 0);
});
