-- 002_builder_billing_credits.sql
-- Additive Builder-only billing foundation. No payment provider or Core schema changes.
-- Do not apply to production until separately reviewed and approved.

CREATE TABLE IF NOT EXISTS builder_subscriptions (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES builder_users(id) ON DELETE CASCADE,
  plan TEXT NOT NULL CHECK (plan IN ('free', 'starter', 'pro', 'business')),
  billing_interval TEXT NOT NULL CHECK (billing_interval IN ('monthly', 'yearly')),
  status TEXT NOT NULL CHECK (status IN ('incomplete', 'active', 'past_due', 'canceled', 'expired')),
  price_usd_cents INTEGER NOT NULL CHECK (price_usd_cents >= 0),
  currency CHAR(3) NOT NULL DEFAULT 'USD' CHECK (currency = 'USD'),
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL CHECK (period_end > period_start),
  cancel_at_period_end BOOLEAN NOT NULL DEFAULT FALSE,
  canceled_at TIMESTAMPTZ,
  provider TEXT,
  provider_customer_id TEXT,
  provider_subscription_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (
    (plan = 'free' AND price_usd_cents = 0)
    OR (plan = 'starter' AND ((billing_interval = 'monthly' AND price_usd_cents = 1200) OR (billing_interval = 'yearly' AND price_usd_cents = 10800)))
    OR (plan = 'pro' AND ((billing_interval = 'monthly' AND price_usd_cents = 2500) OR (billing_interval = 'yearly' AND price_usd_cents = 22800)))
    OR (plan = 'business' AND ((billing_interval = 'monthly' AND price_usd_cents = 5000) OR (billing_interval = 'yearly' AND price_usd_cents = 48000)))
  )
);
CREATE UNIQUE INDEX IF NOT EXISTS builder_subscriptions_provider_id_unique
  ON builder_subscriptions(provider, provider_subscription_id)
  WHERE provider IS NOT NULL AND provider_subscription_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS builder_subscriptions_user_period_idx
  ON builder_subscriptions(user_id, period_end DESC);
CREATE INDEX IF NOT EXISTS builder_subscriptions_status_period_idx
  ON builder_subscriptions(status, period_end);

-- One credit is an internal Builder quota unit, not a Core credit or a USD amount.
-- Signed delta records grants (+), reservations/charges (-), refunds (+), and expiry (-).
CREATE TABLE IF NOT EXISTS builder_credit_ledger (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES builder_users(id) ON DELETE CASCADE,
  delta INTEGER NOT NULL CHECK (delta <> 0),
  balance_after INTEGER NOT NULL CHECK (balance_after >= 0),
  event_type TEXT NOT NULL CHECK (event_type IN ('grant', 'reserve', 'charge', 'refund', 'expire', 'adjustment')),
  idempotency_key TEXT NOT NULL,
  period_start TIMESTAMPTZ,
  period_end TIMESTAMPTZ,
  project_id UUID REFERENCES builder_projects(id) ON DELETE SET NULL,
  job_id TEXT,
  reason TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT builder_credit_ledger_idempotency_unique UNIQUE (user_id, idempotency_key),
  CHECK (period_end IS NULL OR period_start IS NULL OR period_end > period_start)
);
CREATE INDEX IF NOT EXISTS builder_credit_ledger_user_created_idx
  ON builder_credit_ledger(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS builder_credit_ledger_user_period_idx
  ON builder_credit_ledger(user_id, period_start, period_end);
CREATE INDEX IF NOT EXISTS builder_credit_ledger_job_idx
  ON builder_credit_ledger(job_id) WHERE job_id IS NOT NULL;
