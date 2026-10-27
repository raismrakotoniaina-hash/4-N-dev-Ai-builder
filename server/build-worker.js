import { createServer } from 'node:net';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { readdir } from 'node:fs/promises';
import { mkdtemp, mkdir, readFile, rm, writeFile, chmod } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';

const SOCKET_PATH = process.env.BUILDER_WORKER_SOCKET || '/run/4n-dev-ai-builder-worker/worker.sock';
const NODE_MODULES = resolve(process.env.BUILDER_NODE_MODULES || join(process.cwd(), 'node_modules'));
const BUILD_TMP_ROOT = process.env.BUILDER_TMP_DIR || '/var/tmp';
const MAX_REQUEST_BYTES = 1_100_000;
const MAX_FILE_BYTES = 500_000;
const MAX_TOTAL_BYTES = 900_000;
const MAX_LOG_BYTES = 12_000;
const BUILD_TIMEOUT_MS = 120_000;
const VERSION = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;

export function validateGeneratedFiles(files) {
  if (!Array.isArray(files) || files.length < 2 || files.length > 20) {
    throw new Error('Generated app must contain between 2 and 20 files.');
  }
  const seen = new Set();
  let total = 0;
  for (const file of files) {
    if (!file || typeof file.path !== 'string' || !file.path || file.path.length > 240 ||
        file.path.startsWith('/') || file.path.includes('\\') ||
        file.path.split('/').some(part => !part || part === '.' || part === '..') ||
        typeof file.content !== 'string' || !file.content.trim() || seen.has(file.path)) {
      throw new Error('Invalid or duplicate generated file.');
    }
    const size = Buffer.byteLength(file.content, 'utf8');
    if (size > MAX_FILE_BYTES || (total += size) > MAX_TOTAL_BYTES) {
      throw new Error('Generated files exceed size limits.');
    }
    seen.add(file.path);
  }
  if (!seen.has('package.json') || !seen.has('index.html')) {
    throw new Error('Generated app must include package.json and index.html.');
  }
  for (const path of seen) {
    const parts = path.split('/');
    for (let i = 1; i < parts.length; i++) {
      if (seen.has(parts.slice(0, i).join('/'))) {
        throw new Error('Generated file paths conflict.');
      }
    }
  }
}

export async function validateDependencies(packageJson, nodeModules = NODE_MODULES) {
  for (const key of ['dependencies', 'devDependencies', 'optionalDependencies']) {
    const group = packageJson[key] ?? {};
    if (!group || typeof group !== 'object' || Array.isArray(group)) {
      throw new Error('Invalid dependency declaration.');
    }
    for (const [name, requested] of Object.entries(group)) {
      if (!/^(?:@[a-z0-9._-]+\/)?[a-z0-9._-]+$/.test(name)) {
        throw new Error('Invalid dependency name.');
      }
      if (typeof requested !== 'string' || !VERSION.test(requested)) {
        throw new Error(`Dependency "${name}" must use an exact version.`);
      }
      const packagePath = join(nodeModules, ...name.split('/'));
      if (!existsSync(packagePath)) {
        throw new Error(`Dependency "${name}" is not preinstalled.`);
      }
      let installed;
      try {
        installed = JSON.parse(await readFile(join(packagePath, 'package.json'), 'utf8'));
      } catch {
        throw new Error(`Cannot verify preinstalled dependency "${name}".`);
      }
      if (installed.name !== name || installed.version !== requested) {
        throw new Error(`Dependency "${name}" does not match the preinstalled version.`);
      }
    }
  }
}

function runDocker(args, timeout = BUILD_TIMEOUT_MS, cidFile) {
  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn('docker', args, {
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { PATH: '/usr/bin:/bin' }
    });
    let output = '';
    let settled = false;
    const collect = chunk => {
      if (output.length < MAX_LOG_BYTES) output += chunk.toString('utf8').slice(0, MAX_LOG_BYTES - output.length);
    };
    child.stdout.on('data', collect);
    child.stderr.on('data', collect);
    const timer = setTimeout(async () => {
      try {
        const id = (await readFile(cidFile, 'utf8')).trim();
        if (id) {
          const killer = spawn('docker', ['kill', id], { stdio: 'ignore', env: { PATH: '/usr/bin:/bin' } });
          killer.unref();
        }
      } catch {}
      child.kill('SIGKILL');
      finish(new Error('Isolated build timed out.'));
    }, timeout);
    function finish(error, code) {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (error) rejectPromise(error);
      else if (code !== 0) rejectPromise(new Error(output.slice(-3000) || 'Isolated build failed.'));
      else resolvePromise(output.trim());
    }
    child.once('error', error => finish(new Error(`Could not start Docker build: ${error.message}`)));
    child.once('close', code => finish(null, code));
  });
}

async function createSandboxPreview(root) {
  const dist = join(root, 'dist');
  let html = await readFile(join(dist, 'index.html'), 'utf8');
  const assetsDir = join(dist, 'assets');
  const entries = await readdir(assetsDir, { withFileTypes: true }).catch(() => []);
  const assets = new Map();
  const mime = (name) => name.endsWith('.js') ? 'text/javascript'
    : name.endsWith('.css') ? 'text/css'
    : name.endsWith('.svg') ? 'image/svg+xml'
    : name.endsWith('.png') ? 'image/png'
    : name.endsWith('.jpg') || name.endsWith('.jpeg') ? 'image/jpeg'
    : name.endsWith('.webp') ? 'image/webp'
    : name.endsWith('.woff2') ? 'font/woff2'
    : name.endsWith('.woff') ? 'font/woff'
    : name.endsWith('.json') ? 'application/json' : 'application/octet-stream';
  for (const entry of entries) {
    if (!entry.isFile() || !/^[a-zA-Z0-9._-]+$/.test(entry.name)) continue;
    const path = join(assetsDir, entry.name);
    const data = await readFile(path);
    if (data.length > 350_000) continue;
    assets.set('/assets/' + entry.name, { data, type: mime(entry.name) });
  }
  const dataUrl = (asset) => 'data:' + asset.type + ';base64,' + asset.data.toString('base64');
  for (const [url, asset] of assets) {
    if (!asset.type.startsWith('image/') && !asset.type.startsWith('font/')) continue;
    const escaped = url.replaceAll('.', '\\.');
    const replacement = dataUrl(asset);
    html = html.replace(new RegExp(escaped, 'g'), replacement);
  }
  html = html.replace(/<link\b[^>]*rel=["']modulepreload["'][^>]*>/gi, '');
  html = await replaceAsync(html, /<script\b([^>]*?)\bsrc=["']([^"']+\.js)["']([^>]*)><\/script>/gi, async (_tag, before, src, after) => {
    const asset = assets.get(src);
    if (!asset || asset.type !== 'text/javascript') throw new Error('Cannot create isolated preview: JavaScript bundle is missing.');
    let code = asset.data.toString('utf8');
    if (/\bimport\s*(?:\(|[{*'"])/.test(code)) throw new Error('Cannot create isolated preview: split JavaScript bundles are not supported yet.');
    for (const [assetUrl, nested] of assets) if (nested.type.startsWith('image/') || nested.type.startsWith('font/')) code = code.replaceAll(assetUrl, dataUrl(nested));
    return '<script type="module">' + code.replace(/<\/script/gi, '<\\/script') + '</script>';
  });
  html = await replaceAsync(html, /<link\b([^>]*?)\bhref=["']([^"']+\.css)["']([^>]*)>/gi, async (tag, before, href) => {
    const asset = assets.get(href);
    if (!asset || asset.type !== 'text/css') return '';
    let css = asset.data.toString('utf8');
    for (const [assetUrl, nested] of assets) if (nested.type.startsWith('image/') || nested.type.startsWith('font/')) css = css.replaceAll(assetUrl, dataUrl(nested));
    return '<style>' + css.replace(/<\/style/gi, '<\\/style') + '</style>';
  });
  const csp = "<meta http-equiv=\"Content-Security-Policy\" content=\"default-src 'none'; script-src 'unsafe-inline' data:; style-src 'unsafe-inline' data:; img-src data: blob:; font-src data:; connect-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'\">";
  html = html.replace(/<head([^>]*)>/i, '<head$1>' + csp);
  if (Buffer.byteLength(html, 'utf8') > 850_000) throw new Error('Isolated preview exceeds the size limit.');
  return html;
}

async function replaceAsync(input, pattern, replacer) {
  const matches = [...input.matchAll(pattern)];
  let output = input;
  for (const match of matches.reverse()) {
    const replacement = await replacer(...match);
    output = output.slice(0, match.index) + replacement + output.slice(match.index + match[0].length);
  }
  return output;
}

export async function buildGeneratedApp(files) {
  validateGeneratedFiles(files);
  let pkg;
  try {
    pkg = JSON.parse(files.find(file => file.path === 'package.json').content);
  } catch {
    throw new Error('Generated package.json is not valid JSON.');
  }
  if (!pkg || typeof pkg !== 'object' || Array.isArray(pkg) ||
      typeof pkg.scripts?.build !== 'string' || !pkg.scripts.build.includes('vite build')) {
    throw new Error('Generated package.json must define a build script containing vite build.');
  }
  await validateDependencies(pkg);
  const root = await mkdtemp(join(BUILD_TMP_ROOT, '4ndev-build-worker-'));
  const cidFile = join(BUILD_TMP_ROOT, `4ndev-build-cid-${process.pid}-${Date.now()}`);
  try {
    for (const file of files) {
      const target = join(root, file.path);
      await mkdir(dirname(target), { recursive: true, mode: 0o777 });
      await writeFile(target, file.content, { encoding: 'utf8', mode: 0o666, flag: 'wx' });
    }
    await chmod(root, 0o777);
    const output = await runDocker([
      'run', '--rm', '--pull=never', '--cidfile', cidFile, '--network=none', '--read-only',
      '--cap-drop=ALL', '--security-opt=no-new-privileges', '--pids-limit=128',
      '--memory=768m', '--cpus=1', '--tmpfs', '/tmp:rw,nosuid,nodev,size=64m',
      '--tmpfs', '/workspace/node_modules/.vite-temp:rw,nosuid,nodev,size=64m,mode=1777',
      '--user', `${process.getuid()}:${process.getgid()}`,
      '--env', 'HOME=/tmp', '--env', 'npm_config_cache=/tmp/npm-cache',
      '--volume', `${root}:/workspace:rw`,
      '--volume', `${NODE_MODULES}:/workspace/node_modules:ro`,
      '--workdir', '/workspace', 'node:24-bookworm-slim', 'sh', '-lc', 'npm run build'
    ], BUILD_TIMEOUT_MS, cidFile);
    const previewHtml = await createSandboxPreview(root);\n    return { success: true, log: output.slice(-MAX_LOG_BYTES), previewHtml };
  } finally {
    await rm(root, { recursive: true, force: true });
    await rm(cidFile, { force: true });
  }
}

function send(socket, payload) {
  if (!socket.destroyed && !socket.writableEnded) socket.end(JSON.stringify(payload));
}

export function createBuildWorkerServer({ socketPath = SOCKET_PATH, buildImpl = buildGeneratedApp } = {}) {
  const server = createServer({ allowHalfOpen: true }, socket => {
    socket.setTimeout(BUILD_TIMEOUT_MS + 10_000, () => socket.destroy());
    let input = '';
    socket.on('data', chunk => {
      input += chunk.toString('utf8');
      if (Buffer.byteLength(input, 'utf8') > MAX_REQUEST_BYTES) {
        send(socket, { success: false, error: 'Build request exceeds size limits.' });
      }
    });
    socket.on('end', async () => {
      try {
        const request = JSON.parse(input);
        const result = await buildImpl(request.files);
        send(socket, result);
      } catch (error) {
        send(socket, { success: false, error: error instanceof Error ? error.message : 'Isolated build failed.' });
      }
    });
  });
  server.listen(socketPath, async () => {
    await chmod(socketPath, 0o660).catch(() => {});
  });
  return server;
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(new URL(import.meta.url).pathname)) {
  const { unlink } = await import('node:fs/promises');
  await unlink(SOCKET_PATH).catch(() => {});
  createBuildWorkerServer();
  console.log(`4N DEV AI Builder build worker listening on ${SOCKET_PATH}`);
}
