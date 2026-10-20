import { createServer } from 'node:http';
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
  allowedOrigins = getAllowedOrigins()
} = {}) {
  return createServer(async (req, res) => {
    const origin = req.headers.origin;

    if (origin && !allowedOrigins.has(origin)) {
      return json(res, 403, { success: false, error: 'Origin not allowed.' });
    }

    if (origin) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Vary', 'Origin');
    }

    if (req.method === 'OPTIONS') {
      res.writeHead(204, {
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
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

    return json(res, 404, { success: false, error: 'Endpoint not found.' });
  });
}

if (process.argv[1] && new URL(import.meta.url).pathname === process.argv[1]) {
  const server = createBuilderServer();
  server.listen(PORT, HOST, () => {
    console.log(`4N DEV AI Builder backend listening on ${HOST}:${PORT}`);
  });
}
