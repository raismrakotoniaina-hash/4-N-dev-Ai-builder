import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BUILDER_PLANS,
  getBuilderMonthlyCredits,
  getBuilderPlan,
  getBuilderPriceUsdCents,
  getBuilderYearlySavingsUsdCents
} from './builder-plans.js';

test('server-owned plan catalogue matches approved USD prices and monthly quotas', () => {
  assert.deepEqual(
    Object.fromEntries(Object.entries(BUILDER_PLANS).map(([id, p]) => [
      id, { monthly: p.pricesUsdCents.monthly, yearly: p.pricesUsdCents.yearly, credits: p.monthlyCredits }
    ])),
    {
      free: { monthly: 0, yearly: 0, credits: 0 },
      starter: { monthly: 1200, yearly: 10800, credits: 50 },
      pro: { monthly: 2500, yearly: 22800, credits: 150 },
      business: { monthly: 5000, yearly: 48000, credits: 400 }
    }
  );
});

test('yearly savings are calculated from twelve monthly payments', () => {
  assert.equal(getBuilderYearlySavingsUsdCents('starter'), 3600);
  assert.equal(getBuilderYearlySavingsUsdCents('pro'), 7200);
  assert.equal(getBuilderYearlySavingsUsdCents('business'), 12000);
  assert.equal(getBuilderYearlySavingsUsdCents('free'), null);
});

test('unknown plans and intervals are rejected without fallback pricing', () => {
  assert.equal(getBuilderPlan('unknown'), null);
  assert.equal(getBuilderPriceUsdCents('unknown', 'monthly'), null);
  assert.equal(getBuilderPriceUsdCents('starter', 'weekly'), null);
  assert.equal(getBuilderMonthlyCredits('unknown'), null);
});
