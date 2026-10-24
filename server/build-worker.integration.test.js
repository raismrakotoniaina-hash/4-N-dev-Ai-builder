import test from 'node:test';
import assert from 'node:assert/strict';
import { buildGeneratedApp } from './build-worker.js';

const files = [
  {
    path: 'package.json',
    content: JSON.stringify({
      name: 'isolated-build-smoke-test',
      private: true,
      type: 'module',
      scripts: { build: 'vite build' },
      dependencies: { react: '19.3.0', 'react-dom': '19.3.0' },
      devDependencies: { '@vitejs/plugin-react': '6.1.1', vite: '8.3.0' }
    })
  },
  { path: 'index.html', content: '<!doctype html><html><head><meta charset="UTF-8"><title>Smoke test</title></head><body><div id="root"></div><script type="module" src="/src/main.jsx"></script></body></html>' },
  { path: 'vite.config.js', content: "import { defineConfig } from 'vite';\nimport react from '@vitejs/plugin-react';\nexport default defineConfig({ plugins: [react()] });\n" },
  { path: 'src/main.jsx', content: "import React from 'react';\nimport { createRoot } from 'react-dom/client';\ncreateRoot(document.getElementById('root')).render(React.createElement('main', null, 'Isolated build passed'));\n" }
];

test('builds a generated React app in the isolated Docker sandbox', {
  skip: process.env.RUN_ISOLATED_DOCKER_TESTS !== '1'
}, async () => {
  const result = await buildGeneratedApp(files);
  assert.equal(result.success, true);
  assert.match(result.log, /built in/i);
});
