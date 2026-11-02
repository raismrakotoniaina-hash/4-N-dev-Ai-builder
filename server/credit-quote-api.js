import { estimateBuilderCredits } from './credit-pricing.js';

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

export function createCreditQuoteApi({ store }) {
  return async function creditQuoteApi(req, res, url) {
    const match = url.pathname.match(/^\/api\/projects\/([0-9a-f-]{36})\/credit-quote$/i);
    if (!match || req.method !== 'POST') return false;

    const user = await store.getUserForSession(cookieValue(req.headers.cookie));
    if (!user) return send(res, 401, { success: false, error: 'Authentication required.' });

    const project = await store.getProject(user.id, match[1]);
    if (!project) return send(res, 404, { success: false, error: 'Project not found.' });

    let billingState;
    try {
      billingState = await store.getBillingState(user.id);
    } catch {
      return send(res, 503, { success: false, error: 'Builder subscription status is temporarily unavailable.' });
    }

    const subscription = billingState?.subscription;
    if (!subscription || subscription.plan === 'free' || subscription.status !== 'active'
      || !Number.isFinite(Date.parse(subscription.periodEnd)) || Date.parse(subscription.periodEnd) <= Date.now()) {
      return send(res, 403, { success: false, error: 'An active paid Builder plan is required for an AI generation quote.' });
    }

    const chunks = [];
    let size = 0;
    for await (const chunk of req) {
      size += chunk.length;
      if (size > 16000) return send(res, 413, { success: false, error: 'Quote request is too large.' });
      chunks.push(chunk);
    }

    let body;
    try {
      body = chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {};
    } catch {
      return send(res, 400, { success: false, error: 'Request body must be valid JSON.' });
    }

    let quote;
    try {
      quote = estimateBuilderCredits(body.prompt);
    } catch (error) {
      return send(res, 400, { success: false, error: error.message });
    }

    return send(res, 200, {
      success: true,
      quote: {
        ...quote,
        currency: 'Builder Credits',
        chargeEnabled: false,
        message: 'Estimate only. No credits have been reserved or charged.'
      }
    });
  };
}
