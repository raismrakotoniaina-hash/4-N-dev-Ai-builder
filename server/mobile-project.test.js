import test from 'node:test';
import assert from 'node:assert/strict';
import { ensureMobileProject } from './mobile-project.js';

test('adds a separate Expo React Native project for a mobile request', () => {
  const files = [{ path: 'package.json', content: '{"name":"web"}' }, { path: 'index.html', content: '<html></html>' }];
  const result = ensureMobileProject(files, 'Build a mobile app for tracking expenses', 'Expense Tracker');
  assert.deepEqual(result.slice(2).map((file) => file.path), ['mobile/package.json', 'mobile/app.json', 'mobile/App.tsx']);
  assert.equal(JSON.parse(result.find((file) => file.path === 'mobile/package.json').content).dependencies.expo, '53.0.20');
  assert.match(result.find((file) => file.path === 'mobile/App.tsx').content, /Expense Tracker/);
  assert.ok(result.some((file) => file.path === 'package.json' && file.content === '{"name":"web"}'));
});

test('does not add mobile files to a web-only project', () => {
  const files = [{ path: 'package.json', content: '{}' }];
  assert.deepEqual(ensureMobileProject(files, 'Build a responsive web dashboard'), files);
});

test('preserves model-generated mobile files without duplicate paths', () => {
  const files = [
    { path: 'package.json', content: '{}' },
    { path: 'mobile/App.tsx', content: 'export default function App() { return null; }' }
  ];
  const result = ensureMobileProject(files, 'Create an Expo React Native app', 'My App');
  assert.equal(result.filter((file) => file.path === 'mobile/App.tsx').length, 1);
  assert.ok(result.some((file) => file.path === 'mobile/package.json'));
  assert.ok(result.some((file) => file.path === 'mobile/app.json'));
});

test('rejects mobile output that cannot fit the isolated worker file limit', () => {
  const files = Array.from({ length: 19 }, (_, index) => ({ path: 'src/file' + index + '.ts', content: 'export {};'}));
  assert.throws(() => ensureMobileProject(files, 'Build an Android mobile app', 'My App'), /reduce generated files/i);
});
