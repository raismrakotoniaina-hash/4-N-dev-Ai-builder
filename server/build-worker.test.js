import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { validateDependencies, validateGeneratedFiles } from './build-worker.js';

const validFiles = [
  { path: 'package.json', content: JSON.stringify({ scripts: { build: 'tsc -b && vite build' }, dependencies: { react: '19.3.0' } }) },
  { path: 'index.html', content: '<div id="root"></div>' },
  { path: 'src/main.tsx', content: 'console.log("build")' }
];

test('accepts a bounded generated file set with required entry files', () => {
  assert.doesNotThrow(() => validateGeneratedFiles(validFiles));
});

test('rejects path traversal, duplicates, and missing required files', () => {
  assert.throws(() => validateGeneratedFiles([...validFiles, { path: '../outside', content: 'x' }]), /Invalid or duplicate/);
  assert.throws(() => validateGeneratedFiles([validFiles[0], validFiles[1], validFiles[1]]), /Invalid or duplicate/);
  assert.throws(() => validateGeneratedFiles([validFiles[0], validFiles[2]]), /package.json and index.html/);
});

test('accepts only exact versions matching preinstalled package metadata', async (t) => {
  const root = await mkdtemp(join(tmpdir(), '4ndev-deps-test-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(join(root, 'node_modules', 'react'), { recursive: true });
  await writeFile(join(root, 'node_modules', 'react', 'package.json'), JSON.stringify({ name: 'react', version: '19.3.0' }));
  await assert.doesNotReject(validateDependencies({ dependencies: { react: '19.3.0' } }, join(root, 'node_modules')));
  await assert.rejects(validateDependencies({ dependencies: { react: '^19.3.0' } }, join(root, 'node_modules')), /exact version/);
  await assert.rejects(validateDependencies({ dependencies: { react: '19.2.0' } }, join(root, 'node_modules')), /does not match/);
  await assert.rejects(validateDependencies({ dependencies: { unknown: '1.0.0' } }, join(root, 'node_modules')), /not preinstalled/);
});
