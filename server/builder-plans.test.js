import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BILLING_DURATIONS,
  BUILDER_PLANS,
  getBuilderPlan,
  getBuilderPriceUsdCents
} from './builder-plans.js';

test('server-owned plan catalogue matches all approved USD duration prices', () => {
  assert.deepEqual(BILLING_DURATIONS, ['1_month', '3_months', '6_months', '12_months']);
  assert.deepEqual(
    Object.fromEntries(Object.entries(BUILDER_PLANS).map(([id, plan]) => [id, plan.pricesUsdCents])),
    {
      free: { '1_month': 0, '3_months': 0, '6_months': 0, '12_months': 0 },
      starter: { '1_month': 1200, '3_months': 3420, '6_months': 6480, '12_months': 10800 },
      pro: { '1_month': 2500, '3_months': 7125, '6_months': 13500, '12_months': 22800 },
      business: { '1_month': 5000, '3_months': 14250, '6_months': 27000, '12_months': 48000 }
    }
  );
});

test('plans retain the Free prototype-only entitlement', () => {
  assert.equal(BUILDER_PLANS.free.prototypeOnly, true);
  assert.equal(BUILDER_PLANS.starter.prototypeOnly, false);
  assert.equal(BUILDER_PLANS.pro.prototypeOnly, false);
  assert.equal(BUILDER_PLANS.business.prototypeOnly, false);
});

test('unknown plans and durations are rejected without fallback pricing', () => {
  assert.equal(getBuilderPlan('unknown'), null);
  assert.equal(getBuilderPriceUsdCents('unknown', '1_month'), null);
  assert.equal(getBuilderPriceUsdCents('starter', 'weekly'), null);
  assert.equal(getBuilderPriceUsdCents('starter', 'monthly'), null);
});
