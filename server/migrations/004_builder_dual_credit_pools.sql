-- 004_builder_dual_credit_pools.sql
-- Split the existing Builder ledger into independent Builder and app-runtime balances.
-- Existing rows remain in the Builder pool. This migration does not grant credits,
-- expire credits, enable payments, or modify any Core/Console/Chat schema.

ALTER TABLE builder_credit_ledger
  ADD COLUMN IF NOT EXISTS credit_pool TEXT NOT NULL DEFAULT 'builder';

ALTER TABLE builder_credit_ledger
  DROP CONSTRAINT IF EXISTS builder_credit_ledger_credit_pool_check;

ALTER TABLE builder_credit_ledger
  ADD CONSTRAINT builder_credit_ledger_credit_pool_check
  CHECK (credit_pool IN ('builder', 'runtime'));

ALTER TABLE builder_credit_ledger
  DROP CONSTRAINT IF EXISTS builder_credit_ledger_idempotency_unique;

ALTER TABLE builder_credit_ledger
  ADD CONSTRAINT builder_credit_ledger_pool_idempotency_unique
  UNIQUE (user_id, credit_pool, idempotency_key);

CREATE INDEX IF NOT EXISTS builder_credit_ledger_pool_balance_idx
  ON builder_credit_ledger(user_id, credit_pool, id DESC);
