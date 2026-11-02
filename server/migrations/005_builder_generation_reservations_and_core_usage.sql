-- 005_builder_generation_reservations_and_core_usage.sql
-- Builder-only transactional reservations and internal Core cost metering.
-- No Core schema changes, payment activation, credit grants, or production rollout.
CREATE TABLE IF NOT EXISTS builder_credit_reservations (
  user_id UUID NOT NULL REFERENCES builder_users(id) ON DELETE CASCADE,
  job_id TEXT NOT NULL,
  amount INTEGER NOT NULL CHECK (amount > 0),
  idempotency_key TEXT NOT NULL,
  project_id UUID REFERENCES builder_projects(id) ON DELETE SET NULL,
  status TEXT NOT NULL CHECK (status IN ('reserved', 'settled', 'refunded')),
  balance_after INTEGER NOT NULL CHECK (balance_after >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, job_id),
  UNIQUE (user_id, idempotency_key)
);
CREATE INDEX IF NOT EXISTS builder_credit_reservations_status_idx ON builder_credit_reservations(status, updated_at);
CREATE TABLE IF NOT EXISTS builder_core_usage (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES builder_users(id) ON DELETE CASCADE,
  project_id UUID REFERENCES builder_projects(id) ON DELETE SET NULL,
  job_id TEXT NOT NULL,
  stage TEXT NOT NULL,
  model TEXT NOT NULL,
  charged_usd NUMERIC(14,8) CHECK (charged_usd IS NULL OR charged_usd >= 0),
  currency CHAR(3) NOT NULL DEFAULT 'USD',
  usage JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (job_id, stage)
);
CREATE INDEX IF NOT EXISTS builder_core_usage_user_created_idx ON builder_core_usage(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS builder_core_usage_job_idx ON builder_core_usage(job_id);
