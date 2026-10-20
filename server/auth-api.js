import { randomBytes } from 'node:crypto';

const COOKIE_NAME = 'builder_session';
const MAX_BODY_BYTES = 1024 * 1024;

function json(res, status, payload, headers = {}) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
    'X-Frame-Options': 'DENY',
    ...headers
  });
  res.end(JSON.stringify(payload));
}

function readCookie(header = '') {
  for (const item of header.split(';')) {
    const [key, ...rest] = item.trim().split('=');
    if (key === COOKIE_NAME) return rest.join('=');
  }
  return null;
}

function sessionCookie(token, maxAge = 604800) {
  const secure = process.env.NODE_ENV === 'production' || process.env.COOKIE_SECURE === 'true';
  return `${COOKIE_NAME}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure ? '; Secure' : ''}`;
}

async function readJson(req) {
  let size = 0;
  const chunks = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) {
      const error = new Error('Request body is too large.');
      error.statusCode = 413;
      throw error;
    }
    chunks.push(chunk);
  }
  if (!chunks.length) return {};
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); }
  catch {
    const error = new Error('Request body must be valid JSON.');
    error.statusCode = 400;
    throw error;
  }
}

function validEmail(value) {
  return typeof value === 'string' && value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function validPath(value) {
  return typeof value === 'string' && value.length > 0 && value.length <= 240
    && !value.startsWith('/') && !value.includes('\\')
    && !value.split('/').some((part) => !part || part === '.' || part === '..');
}

export function createAuthApi({ store, fetchImpl = globalThis.fetch, coreApiUrl = 'https://api.4ndev.dev' }) {
  return async function handleAuthApi(req, res, url) {
    const method = req.method || 'GET';
    const path = url.pathname;
    const token = readCookie(req.headers.cookie);
    const user = await store.getUserForSession(token);
    try {
      if (method === 'POST' && path === '/api/auth/register') {
        const body = await readJson(req);
        if (!validEmail(body.email)) return json(res, 400, { success: false, error: 'Enter a valid email address.' });
        if (typeof body.password !== 'string' || body.password.length < 12 || body.password.length > 256) {
          return json(res, 400, { success: false, error: 'Password must be 12–256 characters.' });
        }
        try {
          const created = await store.createUser({ email: body.email, password: body.password });
          const session = await store.createSession(created.id);
          return json(res, 201, { success: true, user: created }, { 'Set-Cookie': sessionCookie(session.token) });
        } catch (error) {
          if (error.code === 'EMAIL_EXISTS') return json(res, 409, { success: false, error: error.message });
          throw error;
        }
      }
      if (method === 'POST' && path === '/api/auth/login') {
        const body = await readJson(req);
        if (!validEmail(body.email) || typeof body.password !== 'string') {
          return json(res, 400, { success: false, error: 'Email and password are required.' });
        }
        const authenticated = await store.verifyUser({ email: body.email, password: body.password });
        if (!authenticated) return json(res, 401, { success: false, error: 'Email or password is incorrect.' });
        const session = await store.createSession(authenticated.id);
        return json(res, 200, { success: true, user: authenticated }, { 'Set-Cookie': sessionCookie(session.token) });
      }
      if (method === 'POST' && path === '/api/auth/logout') {
        await store.deleteSession(token);
        return json(res, 200, { success: true }, { 'Set-Cookie': sessionCookie('', 0) });
      }
      if (method === 'GET' && path === '/api/auth/me') {
        return user ? json(res, 200, { success: true, user }) : json(res, 401, { success: false, error: 'Authentication required.' });
      }

      const protectedPath = path.startsWith('/api/core/') || path === '/api/projects' || path.startsWith('/api/projects/');
      if (!protectedPath) return false;
      if (!user) return json(res, 401, { success: false, error: 'Authentication required.' });

      if (method === 'POST' && path === '/api/core/connect') {
        const body = await readJson(req);
        const apiKey = typeof body.apiKey === 'string' ? body.apiKey.trim() : '';
        if (!/^4ndev_sk_[A-Za-z0-9_-]{16,}$/.test(apiKey)) {
          return json(res, 400, { success: false, error: 'Enter a valid 4N DEV Core secret key.' });
        }
        let response;
        try {
          response = await fetchImpl(`${coreApiUrl.replace(/\/$/, '')}/v1/credits`, {
            headers: { Accept: 'application/json', Authorization: `Bearer ${apiKey}` },
            signal: AbortSignal.timeout(8000)
          });
        } catch {
          return json(res, 502, { success: false, error: 'Could not reach 4N DEV Core to verify the key.' });
        }
        let payload = {};
        try { payload = await response.json(); } catch {}
        if (!response.ok || payload.success === false) {
          return json(res, 401, { success: false, error: 'Core rejected this key. Check it in Core Console.' });
        }
        try { await store.connectCoreKey(user.id, apiKey); }
        catch (error) { return json(res, 503, { success: false, error: error.message }); }
        return json(res, 200, { success: true, connected: true });
      }

      if (path === '/api/core/connection' && method === 'GET') {
        return json(res, 200, { success: true, ...(await store.coreConnectionStatus(user.id)) });
      }
      if (path === '/api/core/connection' && method === 'DELETE') {
        await store.disconnectCoreKey(user.id);
        return json(res, 200, { success: true, connected: false });
      }
      if (path === '/api/core/credits' && method === 'GET') {
        const apiKey = await store.getCoreKey(user.id);
        if (!apiKey) return json(res, 409, { success: false, error: 'Connect a 4N DEV Core key first.' });
        try {
          const response = await fetchImpl(`${coreApiUrl.replace(/\/$/, '')}/v1/credits`, {
            headers: { Accept: 'application/json', Authorization: `Bearer ${apiKey}` },
            signal: AbortSignal.timeout(8000)
          });
          const payload = await response.json();
          if (!response.ok || payload.success === false) {
            await store.disconnectCoreKey(user.id);
            return json(res, 401, { success: false, error: 'Core key is no longer valid. Reconnect it in settings.' });
          }
          return json(res, 200, { success: true, credits: payload });
        } catch {
          return json(res, 502, { success: false, error: 'Could not load Core balance right now.' });
        }
      }

      if (method === 'GET' && path === '/api/projects') {
        return json(res, 200, { success: true, projects: await store.listProjects(user.id) });
      }
      if (method === 'POST' && path === '/api/projects') {
        const body = await readJson(req);
        if (typeof body.name !== 'string' || !body.name.trim() || body.name.trim().length > 120) {
          return json(res, 400, { success: false, error: 'Project name must contain 1–120 characters.' });
        }
        if (typeof body.description === 'string' && body.description.length > 2000) {
          return json(res, 400, { success: false, error: 'Project description is too long.' });
        }
        return json(res, 201, { success: true, project: await store.createProject(user.id, body) });
      }

      const projectMatch = path.match(/^\/api\/projects\/([0-9a-f-]{36})$/i);
      if (projectMatch) {
        const id = projectMatch[1];
        if (method === 'GET') {
          const project = await store.getProject(user.id, id);
          return project ? json(res, 200, { success: true, project }) : json(res, 404, { success: false, error: 'Project not found.' });
        }
        if (method === 'PATCH') {
          const body = await readJson(req);
          if (body.name !== undefined && (typeof body.name !== 'string' || !body.name.trim() || body.name.trim().length > 120)) {
            return json(res, 400, { success: false, error: 'Project name must contain 1–120 characters.' });
          }
          const project = await store.updateProject(user.id, id, body);
          return project ? json(res, 200, { success: true, project }) : json(res, 404, { success: false, error: 'Project not found.' });
        }
        if (method === 'DELETE') {
          const deleted = await store.deleteProject(user.id, id);
          return deleted ? json(res, 200, { success: true }) : json(res, 404, { success: false, error: 'Project not found.' });
        }
      }

      const filesMatch = path.match(/^\/api\/projects\/([0-9a-f-]{36})\/files$/i);
      if (filesMatch && method === 'PUT') {
        const body = await readJson(req);
        if (!validPath(body.path) || typeof body.content !== 'string' || body.content.length > 500_000) {
          return json(res, 400, { success: false, error: 'Provide a safe relative file path and content under 500 KB.' });
        }
        const file = await store.putFile(user.id, filesMatch[1], body);
        return file ? json(res, 200, { success: true, file }) : json(res, 404, { success: false, error: 'Project not found.' });
      }
      if (filesMatch && method === 'DELETE') {
        const filePath = url.searchParams.get('path');
        if (!validPath(filePath)) return json(res, 400, { success: false, error: 'Provide a safe relative file path.' });
        const deleted = await store.deleteFile(user.id, filesMatch[1], filePath);
        if (deleted === null) return json(res, 404, { success: false, error: 'Project not found.' });
        return deleted ? json(res, 200, { success: true }) : json(res, 404, { success: false, error: 'File not found.' });
      }
      return json(res, 404, { success: false, error: 'Endpoint not found.' });
    } catch (error) {
      return json(res, error.statusCode || 500, {
        success: false,
        error: error.statusCode ? error.message : 'An internal server error occurred.'
      });
    }
  };
}
