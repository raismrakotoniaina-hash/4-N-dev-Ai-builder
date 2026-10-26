import { createServer } from 'node:http';
import { createPersistence } from './persistence.js';
import { createConfiguredStore } from './store-factory.js';
import { createAuthApi } from './auth-api.js';
import { createGenerationApi } from './generation-api.js';
import { createFreePrototypeApi } from './free-prototype-api.js';
import { validateBuild } from './build-worker-client.js';
import { CORE_API_URL_DEFAULT, normalizeCoreModels } from './model-catalog.js';

const PORT = Number.parseInt(process.env.PORT || '8787', 10);
const HOST = process.env.HOST || '127.0.0.1';
const CORE_API_URL = (process.env.CORE_API_URL || CORE_API_URL_DEFAULT).replace(/\/$/, '');
const DEFAULT_ALLOWED_ORIGINS = 'http://localhost:5173,http://127.0.0.1:5173';

function json(res, statusCode, payload) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer'
  });
  res.end(JSON.stringify(payload));
}

function getAllowedOrigins(value = process.env.BUILDER_ALLOWED_ORIGINS || DEFAULT_ALLOWED_ORIGINS) {
  return new Set(value.split(',').map((origin) => origin.trim()).filter(Boolean));
}

export function createBuilderServer({
  fetchImpl = globalThis.fetch,
  coreApiUrl = CORE_API_URL,
  allowedOrigins = getAllowedOrigins(),
  store = createPersistence(),
  buildValidator = validateBuild,
  coreApiKey = process.env.BUILDER_CORE_API_KEY
} = {}) {
  const authApi = createAuthApi({ store, fetchImpl, coreApiUrl });
  const generationApi = createGenerationApi({ store, fetchImpl, coreApiUrl, coreApiKey, buildValidator });
  const freePrototypeApi = createFreePrototypeApi({ store, buildValidator });
  return createServer(async (req, res) => {
    const origin = req.headers.origin;

    if (origin && !allowedOrigins.has(origin)) {
      return json(res, 403, { success: false, error: 'Origin not allowed.' });
    }

    if (origin) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Credentials', 'true');
      res.setHeader('Vary', 'Origin');
    }

    if (req.method === 'OPTIONS') {
      res.writeHead(204, {
        'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Credentials': 'true',
        'Access-Control-Max-Age': '600',
        'Vary': 'Origin'
      });
      return res.end();
    }

    const url = new URL(req.url || '/', 'http://localhost');

    if (req.method === 'GET' && url.pathname === '/health') {
      return json(res, 200, { success: true, service: '4N DEV AI Builder backend', status: 'online' });
    }

    if (req.method === 'GET' && url.pathname === '/api/models') {
      try {
        const upstream = await fetchImpl(`${coreApiUrl}/v1/models`, {
          method: 'GET',
          headers: { Accept: 'application/json' },
          signal: AbortSignal.timeout(8000)
        });

        if (!upstream.ok) {
          return json(res, 502, { success: false, error: 'Core model catalogue is temporarily unavailable.' });
        }

        const payload = await upstream.json();
        const models = normalizeCoreModels(payload);
        return json(res, 200, { success: true, models });
      } catch (error) {
        const missing = error?.code === 'CORE_MODEL_CATALOG_INCOMPLETE';
        return json(res, missing ? 503 : 502, {
          success: false,
          error: missing
            ? 'Core does not currently expose all four required Builder models.'
            : 'Could not reach the Core model catalogue.'
        });
      }
    }

    const prototype = await freePrototypeApi(req, res, url);
    if (prototype !== false) return;
    const generated = await generationApi(req, res, url);
    if (generated !== false) return;
    const handled = await authApi(req, res, url);
    if (handled !== false) return;

    return json(res, 404, { success: false, error: 'Endpoint not found.' });
  });
}

if (process.argv[1] && new URL(import.meta.url).pathname === process.argv[1]) {
  createConfiguredStore().then(({ store, pool, backend }) => {
    const server = createBuilderServer({ store });
    server.listen(PORT, HOST, () => {
      console.log(`4N DEV AI Builder backend listening on ${HOST}:${PORT} (persistence: ${backend})`);
    });
    const shutdown = () => server.close(async () => {
      if (pool) await pool.end();
      process.exit(0);
    });
    process.once('SIGTERM', shutdown);
    process.once('SIGINT', shutdown);
  }).catch((error) => {
    console.error(`Builder backend startup failed: ${error.message}`);
    process.exitCode = 1;
  });
}
