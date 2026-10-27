// Server-owned Builder plan catalogue. This does not charge payments or grant credits.
export const BUILDER_PLANS = Object.freeze({
  free: Object.freeze({
    id: 'free',
    pricesUsdCents: Object.freeze({ monthly: 0, yearly: 0 }),
    monthlyCredits: 0,
    prototypeOnly: true
  }),
  starter: Object.freeze({
    id: 'starter',
    pricesUsdCents: Object.freeze({ monthly: 1200, yearly: 10800 }),
    monthlyCredits: 50,
    prototypeOnly: false
  }),
  pro: Object.freeze({
    id: 'pro',
    pricesUsdCents: Object.freeze({ monthly: 2500, yearly: 22800 }),
    monthlyCredits: 150,
    prototypeOnly: false
  }),
  business: Object.freeze({
    id: 'business',
    pricesUsdCents: Object.freeze({ monthly: 5000, yearly: 48000 }),
    monthlyCredits: 400,
    prototypeOnly: false
  })
});

export function getBuilderPlan(planId) {
  return typeof planId === 'string' && Object.hasOwn(BUILDER_PLANS, planId)
    ? BUILDER_PLANS[planId]
    : null;
}

export function getBuilderPriceUsdCents(planId, interval) {
  const plan = getBuilderPlan(planId);
  if (!plan || (interval !== 'monthly' && interval !== 'yearly')) return null;
  return plan.pricesUsdCents[interval];
}

export function getBuilderMonthlyCredits(planId) {
  return getBuilderPlan(planId)?.monthlyCredits ?? null;
}

export function getBuilderYearlySavingsUsdCents(planId) {
  const plan = getBuilderPlan(planId);
  if (!plan || planId === 'free') return null;
  return plan.pricesUsdCents.monthly * 12 - plan.pricesUsdCents.yearly;
}
