-- 003_builder_billing_durations.sql
-- Expand Builder subscription durations. This migration only touches Builder billing data.
-- Existing monthly/yearly records are preserved as 1_month/12_months.

ALTER TABLE builder_subscriptions
  DROP CONSTRAINT IF EXISTS builder_subscriptions_billing_interval_check;

ALTER TABLE builder_subscriptions
  DROP CONSTRAINT IF EXISTS builder_subscriptions_check;

UPDATE builder_subscriptions
SET billing_interval = CASE
  WHEN billing_interval = 'monthly' THEN '1_month'
  WHEN billing_interval = 'yearly' THEN '12_months'
  ELSE billing_interval
END;

ALTER TABLE builder_subscriptions
  ADD CONSTRAINT builder_subscriptions_billing_interval_check
  CHECK (billing_interval IN ('1_month', '3_months', '6_months', '12_months'));

ALTER TABLE builder_subscriptions
  ADD CONSTRAINT builder_subscriptions_duration_price_check
  CHECK (
    (plan = 'free' AND price_usd_cents = 0)
    OR (plan = 'starter' AND (
      (billing_interval = '1_month' AND price_usd_cents = 1200)
      OR (billing_interval = '3_months' AND price_usd_cents = 3420)
      OR (billing_interval = '6_months' AND price_usd_cents = 6480)
      OR (billing_interval = '12_months' AND price_usd_cents = 10800)
    ))
    OR (plan = 'pro' AND (
      (billing_interval = '1_month' AND price_usd_cents = 2500)
      OR (billing_interval = '3_months' AND price_usd_cents = 7125)
      OR (billing_interval = '6_months' AND price_usd_cents = 13500)
      OR (billing_interval = '12_months' AND price_usd_cents = 22800)
    ))
    OR (plan = 'business' AND (
      (billing_interval = '1_month' AND price_usd_cents = 5000)
      OR (billing_interval = '3_months' AND price_usd_cents = 14250)
      OR (billing_interval = '6_months' AND price_usd_cents = 27000)
      OR (billing_interval = '12_months' AND price_usd_cents = 48000)
    ))
  );
