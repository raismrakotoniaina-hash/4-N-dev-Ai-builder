const COOKIE = 'builder_session';

function cookieValue(header = '') {
  for (const item of header.split(';')) {
    const [key, ...rest] = item.trim().split('=');
    if (key === COOKIE) return rest.join('=');
  }
  return null;
}

function send(res, status, payload) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff'
  });
  res.end(JSON.stringify(payload));
}

export function createBuildValidationApi({ store, buildValidator }) {
  return async function buildValidationApi(req, res, url) {
    const match = url.pathname.match(/^\/api\/projects\/([0-9a-f-]{36})\/validate$/i);
    if (!match || req.method !== 'POST') return false;

    const user = await store.getUserForSession(cookieValue(req.headers.cookie));
    if (!user) return send(res, 401, { success: false, error: 'Authentication required.' });

    const project = await store.getProject(user.id, match[1]);
    if (!project) return send(res, 404, { success: false, error: 'Project not found.' });

    const files = (project.files || []).filter(file => file.path !== '__4ndev_preview.html');
    if (files.length < 2) {
      return send(res, 422, { success: false, error: 'Save at least two source files before building.' });
    }

    try {
      const result = await buildValidator(files);
      if (!result?.success) {
        return send(res, 422, { success: false, error: 'Build validation did not succeed.' });
      }

      if (typeof result.previewHtml === 'string' && result.previewHtml.length > 0) {
        const saved = await store.putFile(user.id, match[1], {
          path: '__4ndev_preview.html',
          content: result.previewHtml
        });
        if (!saved) return send(res, 404, { success: false, error: 'Project not found while saving the validated preview.' });
      }

      return send(res, 200, {
        success: true,
        project: await store.getProject(user.id, match[1]),
        previewAvailable: typeof result.previewHtml === 'string' && result.previewHtml.length > 0,
        log: typeof result.log === 'string' ? result.log.slice(-12000) : ''
      });
    } catch (error) {
      const status = Number.isInteger(error?.statusCode) && error.statusCode >= 400 && error.statusCode <= 599
        ? error.statusCode : 422;
      return send(res, status, {
        success: false,
        error: error instanceof Error ? error.message.slice(0, 1000) : 'Build validation failed.'
      });
    }
  };
}
