# 4N DEV AI Builder billing and credits review

Status: verification branch only. This document does not authorize a production migration, service restart, deployment, payment activation, or OAuth activation.

## Commercial plan catalogue

Prices are USD total amounts for the selected term:

| Plan | 1 month | 3 months | 6 months | 12 months |
|---|---:|---:|---:|---:|
| Starter | $12 | $34.20 | $64.80 | $108 |
| Pro | $25 | $71.25 | $135 | $228 |
| Business | $50 | $142.50 | $270 | $480 |

Free remains local prototype-only. GitHub entitlement is limited to Pro and Business in the pricing UI. Monthly credit allowances are deliberately not asserted here: no confirmed quota policy or cost-based allocation is wired into the product.

## Audit findings

- The previous ledger stored one global balance and could not isolate build-time and app-runtime consumption.
- The generation API checks paid subscription status and calls the user's configured 4N Core key. The current branch does not debit Builder credits for generation; tests explicitly verify this. Core usage is billed by Core independently.
- There is no runtime integration gateway or active app connector execution layer yet.
- Monthly credit grants, period-bound expiry, no-rollover enforcement, renewal, and downgrade jobs are not implemented.
- Checkout, payment webhooks, GitHub OAuth, repository sync, and public publishing are not implemented or enabled.

## Changes in this verification branch

- Added a separate `credit_pool` field to the Builder credit ledger, with `builder` and `runtime` pools.
- Existing ledger rows remain in the Builder pool through a safe default in migration 004.
- Added independent grant/consume persistence methods for runtime credits.
- Added a server-owned GitHub entitlement map: Pro and Business are enabled; Free and Starter are disabled. This is policy data for server-side integration routes, not an active GitHub OAuth connector.
- Billing state now returns `builderCreditsBalance` and `runtimeCreditsBalance`; the legacy `creditsBalance` field remains an alias for the Builder pool.
- In-memory persistence and PostgreSQL persistence use independent running balances and idempotency scopes per pool.
- Added tests for pool isolation, independent idempotency keys, insufficient balance protection, and migration discovery.
- Added transactional Builder generation reservations with idempotent settlement/refund operations in both JSON and PostgreSQL stores.
- Added a Builder-only internal Core usage ledger that records per-stage model and reported `charged_usd` without changing Core.
- Builder debits remain disabled unless `BUILDER_CREDITS_CHARGING_ENABLED=true`; when enabled, generation requires the platform-owned `BUILDER_CORE_API_KEY`, never the customer's Core key, to avoid double billing.
- Migration 005 creates the reservation state table and internal Core usage ledger; it is not applied to production.
- No monthly credit grants or quotas are enabled; the feature flag must remain off until allowances, funding, and period expiry are approved.
- No Core, Console, N-AI Chat, or production configuration changes.

## Still blocked — do not launch billing or integrations

1. Define and approve monthly Builder and Runtime credit allowances after measuring actual costs.
2. Decide whether Builder generation uses only the customer's Core balance, Builder Credits, or an explicitly disclosed combination. Do not silently double-charge.
3. Implement a transactional credit-lot/expiry model before enabling monthly grants or expiry. The current pool ledger is a running balance and does not enforce monthly expiry.
4. Implement a metering gateway and connect each first-party app integration to it before charging Runtime Credits.
5. Implement credential storage and OAuth lifecycle (encrypted API keys, least-privilege scopes, revocation, token refresh) before exposing app integrations.
6. Implement payment checkout, signed/replay-safe webhooks, renewal retries, cancellation and downgrade lifecycle before enabling payments.
7. Register and validate GitHub OAuth credentials and callback handling before activating GitHub sync. Keep the entitlement restricted to Pro and Business.
8. Review and rehearse migration 004 against a disposable Builder-only PostgreSQL database. Never point it at Core.

## Required validation before release

- All existing server tests and the frontend production build pass.
- PostgreSQL migration 004 is discovered and applied transactionally in a disposable database.
- Both credit pools remain independent under duplicate requests and concurrent consumption.
- No generation charge is performed until the selected billing policy and corresponding refund behavior are implemented and tested.
- No runtime integration consumes credits until a metering gateway records an idempotent usage event.
