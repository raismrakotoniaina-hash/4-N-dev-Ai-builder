// Server-owned Builder plan catalogue. Prices are total USD amounts for the selected duration.
export const BILLING_DURATIONS = Object.freeze(['1_month', '3_months', '6_months', '12_months']);

export const BUILDER_PLANS = Object.freeze({
  free: Object.freeze({
    id: 'free',
    pricesUsdCents: Object.freeze({ '1_month': 0, '3_months': 0, '6_months': 0, '12_months': 0 }),
    prototypeOnly: true
  }),
  starter: Object.freeze({
    id: 'starter',
    pricesUsdCents: Object.freeze({ '1_month': 1200, '3_months': 3420, '6_months': 6480, '12_months': 10800 }),
    prototypeOnly: false
  }),
  pro: Object.freeze({
    id: 'pro',
    pricesUsdCents: Object.freeze({ '1_month': 2500, '3_months': 7125, '6_months': 13500, '12_months': 22800 }),
    prototypeOnly: false
  }),
  business: Object.freeze({
    id: 'business',
    pricesUsdCents: Object.freeze({ '1_month': 5000, '3_months': 14250, '6_months': 27000, '12_months': 48000 }),
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
  if (!plan || !BILLING_DURATIONS.includes(interval)) return null;
  return plan.pricesUsdCents[interval];
}
