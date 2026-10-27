# 4N DEV AI Builder billing and credits review

Status: review branch only. This document does not authorize a production migration, service restart, deployment, or payment activation.

## Approved commercial policy

All prices are USD and annual subscriptions are paid upfront for 12 months.

| Plan | Monthly price | Annual upfront | Monthly-equivalent annual price | Monthly credit allowance |
|---|---:|---:|---:|---:|
| Free | $0 | $0 | $0 | 0 |
| Starter | $12 | $108 | $9 | 50 |
| Pro | $25 | $228 | $19 | 150 |
| Business | $50 | $480 | $40 | 400 |

- Monthly subscriptions renew at the monthly price.
- Annual subscriptions renew every 12 months at the annual upfront price.
- Annual subscribers receive only one month's credit allowance per monthly period, not 12 months of credits upfront.
- Unused monthly credits expire at the end of their period and do not roll over.
- Cancellation preserves paid access through the already-paid period; no future monthly credit grant is made after that period.
- If renewal payment fails, retry according to the payment provider's supported policy; after the retry policy is exhausted, downgrade access to Free. Preserve projects/files, but disable paid AI generation.
- A failed generation must refund its Builder credit charge. Refund operations must be idempotent and failures must be surfaced rather than silently treated as successful.
- Builder credits are internal quota units, not Core credits and not a USD balance.
- No Core API, Core Console, or N-AI Chat schema/configuration is part of this billing change.

## Current implementation review

Implemented in this review branch:
- Centralize plan price lookup through `server/builder-plans.js` for both JSON and PostgreSQL persistence, reducing price drift.
- The generation API retries a failed refund once using the same idempotency key and returns an explicit `refundPending` response with a job reference if the database still cannot confirm the refund.
- The billing endpoint explicitly reports monthly grant, expiry, and rollover lifecycle as `not_enabled`.
- Tests cover the approved plan catalogue, billing status flags, and a refund-persistence failure.

Already aligned:
- The current catalogue and migration SQL use the approved prices and quotas.
- Checkout and automatic renewal are disabled (`paymentsEnabled: false`, `renewalEnabled: false`).

## Production blockers — do not enable billing yet

1. No payment provider checkout/webhook flow is implemented or enabled.
2. No scheduled subscription-renewal / failed-payment retry / downgrade worker is implemented.
3. Monthly credit allocation and period-end expiry are not implemented. The current ledger balance is a global running balance; its period columns alone do not enforce monthly expiration or prevent rollover.
4. The current ledger is not a per-period credit-lot model. Implement transactional credit lots or an equivalent allocation model before enforcing expiry. Generation refunds should return credits to the original allocation where possible.
5. Migration `002_builder_billing_credits.sql` is not recorded as applied in the current production database, and the two billing tables were not present in the read-only check. Do not run it until the schema, prices, rollout plan, and tests are reviewed and the user explicitly approves the production migration.
6. The migration runner and deployment need a separate reviewed rollout procedure. This branch must be tested before any production action.

## Required tests before billing launch

- Price catalogue and SQL constraints match for every plan and interval.
- Annual price is charged once upfront; monthly credits are granted once per month using an idempotency key.
- Monthly credits expire at the period boundary; no rollover or double grant on retries.
- Consumption cannot spend expired credits or drive a balance negative under concurrent requests.
- Refunds are idempotent, return credits to the correct period allocation, and report a support reference if persistence fails.
- Cancellation keeps access until period end and prevents later grants.
- Failed renewal retries and eventual Free downgrade preserve projects/files.
- Payment webhooks are authenticated, replay-safe, and cannot grant credits before verified payment.
- Tests and migration rehearsal run against a disposable Builder-only PostgreSQL database, never the Core database.
