import test from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import { chooseTemplate, makeFiles, createFreePrototypeApi } from './free-prototype-api.js';

const PROJECT_ID = '123e4567-e89b-12d3-a456-426614174000';

function responseStub() {
  return {
    statusCode: 200,
    headers: {},
    body: '',
    writeHead(statusCode, headers) { this.statusCode = statusCode; this.headers = headers; },
    end(body = '') { this.body = body; }
  };
}

function request({ cookie = 'builder_session=valid-session', body = { prompt: 'Mamorona pejy fandraisana ho an’ny orinasako' }, method = 'POST' } = {}) {
  const req = Readable.from([Buffer.from(JSON.stringify(body))]);
  req.method = method;
  req.headers = { cookie };
  return req;
}

test('template selection is deterministic and never requires a Core call', () => {
  assert.equal(chooseTemplate('portfolio manokana'), 'portfolio');
  assert.equal(chooseTemplate('dashboard fitantanana'), 'dashboard');
  assert.equal(chooseTemplate('boutique sy vokatra'), 'business');
  assert.equal(chooseTemplate('tranonkala manokana'), 'portfolio');
  assert.equal(chooseTemplate('tabilao sy tatitra'), 'dashboard');
  assert.equal(chooseTemplate('fivarotana vokatra'), 'business');
  assert.equal(chooseTemplate('pejy fandraisana'), 'landing');
});

test('template files form a bounded, runnable Vite app', () => {
  const files = makeFiles({ projectName: 'Boutique', prompt: 'Mamorona boutique', template: 'business' });
  const paths = files.map(file => file.path);
  assert.ok(paths.includes('package.json'));
  assert.ok(paths.includes('index.html'));
  assert.ok(paths.includes('src/main.tsx'));
  assert.ok(paths.includes('src/App.tsx'));
  assert.ok(paths.includes('src/index.css'));
  assert.ok(files.length <= 8);
  const pkg = JSON.parse(files.find(file => file.path === 'package.json').content);
  assert.equal(pkg.scripts.build, 'tsc -b && vite build');
  assert.equal(pkg.dependencies.react, '19.3.0');
  assert.match(files.find(file => file.path === 'src/App.tsx').content, /Prototype Free/);
});

test('authenticated owner gets a saved prototype with zero Core calls', async () => {
  const saved = [];
  let buildCount = 0;
  const project = { id: PROJECT_ID, name: 'My portfolio', files: [] };
  const store = {
    async getUserForSession(token) { return token === 'valid-session' ? { id: 'user-1' } : null; },
    async getProject(userId, projectId) { return userId === 'user-1' && projectId === PROJECT_ID ? project : null; },
    async putFiles(userId, projectId, files) { assert.equal(userId, 'user-1'); assert.equal(projectId, PROJECT_ID); saved.push(...files); return files; }
  };
  const handler = createFreePrototypeApi({ store, buildValidator: async files => { buildCount++; assert.ok(files.length >= 5); return { success: true }; } });
  const res = responseStub();
  await handler(request({ body: { prompt: 'Mamorona portfolio manokana' } }), res, new URL('/api/projects/' + PROJECT_ID + '/prototype', 'http://localhost'));
  assert.equal(res.statusCode, 200);
  const payload = JSON.parse(res.body);
  assert.equal(payload.success, true);
  assert.equal(payload.mode, 'free-template');
  assert.equal(payload.coreCalls, 0);
  assert.equal(payload.template, 'portfolio');
  assert.equal(buildCount, 1);
  assert.ok(saved.some(file => file.path === 'src/App.tsx'));
});

test('prototype endpoint rejects unauthenticated requests', async () => {
  const store = { async getUserForSession() { return null; } };
  const handler = createFreePrototypeApi({ store });
  const res = responseStub();
  await handler(request({ cookie: '', body: { prompt: 'portfolio' } }), res, new URL('/api/projects/' + PROJECT_ID + '/prototype', 'http://localhost'));
  assert.equal(res.statusCode, 401);
  assert.equal(JSON.parse(res.body).success, false);
});

test('prototype endpoint rejects empty prompts before building', async () => {
  const store = {
    async getUserForSession() { return { id: 'user-1' }; },
    async getProject() { throw new Error('must not load project for an invalid prompt'); }
  };
  const handler = createFreePrototypeApi({ store });
  const res = responseStub();
  await handler(request({ body: { prompt: '  ' } }), res, new URL('/api/projects/' + PROJECT_ID + '/prototype', 'http://localhost'));
  assert.equal(res.statusCode, 400);
});


test('unowned projects are never built or modified', async () => {
  let buildCount = 0;
  let saveCount = 0;
  const store = {
    async getUserForSession() { return { id: 'user-2' }; },
    async getProject() { return null; },
    async putFiles() { saveCount++; }
  };
  const handler = createFreePrototypeApi({ store, buildValidator: async () => { buildCount++; return { success: true }; } });
  const res = responseStub();
  await handler(request({ body: { prompt: 'portfolio' } }), res, new URL('/api/projects/' + PROJECT_ID + '/prototype', 'http://localhost'));
  assert.equal(res.statusCode, 404);
  assert.equal(buildCount, 0);
  assert.equal(saveCount, 0);
});

test('failed isolated build does not save any generated files', async () => {
  let saveCount = 0;
  const store = {
    async getUserForSession() { return { id: 'user-1' }; },
    async getProject() { return { id: PROJECT_ID, name: 'Test project' }; },
    async putFiles() { saveCount++; }
  };
  const handler = createFreePrototypeApi({
    store,
    buildValidator: async () => { throw Object.assign(new Error('Build failed'), { statusCode: 422 }); }
  });
  const res = responseStub();
  await handler(request({ body: { prompt: 'Mamorona pejy fandraisana' } }), res, new URL('/api/projects/' + PROJECT_ID + '/prototype', 'http://localhost'));
  assert.equal(res.statusCode, 422);
  assert.equal(JSON.parse(res.body).success, false);
  assert.equal(saveCount, 0);
});

test('overlong prompt is rejected before project lookup or build', async () => {
  let projectLookups = 0;
  const store = {
    async getUserForSession() { return { id: 'user-1' }; },
    async getProject() { projectLookups++; return { id: PROJECT_ID, name: 'Test' }; }
  };
  const handler = createFreePrototypeApi({ store, buildValidator: async () => { throw new Error('must not build'); } });
  const res = responseStub();
  await handler(request({ body: { prompt: 'x'.repeat(4001) } }), res, new URL('/api/projects/' + PROJECT_ID + '/prototype', 'http://localhost'));
  assert.equal(res.statusCode, 400);
  assert.equal(projectLookups, 0);
});
