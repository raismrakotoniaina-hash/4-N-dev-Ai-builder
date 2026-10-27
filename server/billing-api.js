import { BUILDER_PLANS, getBuilderYearlySavingsUsdCents } from './builder-plans.js';

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

export function createBillingApi({ store }) {
  return async function billingApi(req, res, url) {
    if (url.pathname !== '/api/billing' || req.method !== 'GET') return false;
    const user = await store.getUserForSession(cookieValue(req.headers.cookie));
    if (!user) return send(res, 401, { success: false, error: 'Authentication required.' });
    if (typeof store.getBillingState !== 'function') {
      return send(res, 503, { success: false, error: 'Billing persistence is not configured.' });
    }
    const state = await store.getBillingState(user.id);
    const plans = Object.values(BUILDER_PLANS).map((plan) => ({
      id: plan.id,
      pricesUsdCents: plan.pricesUsdCents,
      monthlyCredits: plan.monthlyCredits,
      yearlySavingsUsdCents: getBuilderYearlySavingsUsdCents(plan.id),
      yearlyMonthlyEquivalentUsdCents: plan.id === 'free' ? 0 : Math.round(plan.pricesUsdCents.yearly / 12),
      prototypeOnly: plan.prototypeOnly
    }));
    return send(res, 200, {
      success: true,
      billing: {
        ...state,
        plans,
        paymentsEnabled: false,
        renewalEnabled: false,
        // Monthly quota issuance/expiry is intentionally reported as disabled
        // until the transactional credit-lot lifecycle and scheduled renewal
        // worker are implemented and tested.
        creditsPolicy: {
          monthlyGrantEnabled: false,
          monthlyExpiryEnabled: false,
          rolloverEnabled: false,
          status: 'not_enabled'
        }
      }
    });
  };
}
