-- 006_builder_one_time_free_core_generation.sql
-- One lifetime Core-backed free generation per Builder account.
CREATE TABLE IF NOT EXISTS builder_free_generation_claims (
  user_id UUID PRIMARY KEY REFERENCES builder_users(id) ON DELETE CASCADE,
  job_id TEXT NOT NULL UNIQUE,
  project_id UUID REFERENCES builder_projects(id) ON DELETE SET NULL,
  status TEXT NOT NULL CHECK (status IN ('reserved', 'completed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS builder_free_generation_claims_status_idx
  ON builder_free_generation_claims(status, updated_at);
