# Free prototype implementation plan

## Scope of this branch

This branch introduces the first Free prototype path only. It is not deployed and must not be merged or applied to production without explicit approval.

## User flow

1. A signed-in user enters an app description.
2. The Builder creates a project in the existing project store.
3. `POST /api/projects/:id/prototype` authenticates the session and checks project ownership.
4. A deterministic template selector chooses landing, portfolio, business, or dashboard.
5. The template engine creates a small React + TypeScript + Vite file set.
6. The existing isolated build worker validates the generated files.
7. Files are saved only after build validation succeeds.
8. The response declares `mode: "free-template"` and `coreCalls: 0`.

## Non-negotiable constraints

- The Free endpoint does not import or call the Core client and must never call a Core API.
- The frontend Free action must call only the prototype endpoint.
- User-provided prompts are inserted as JSON string literals in generated source, never evaluated as code.
- Project ownership is checked server-side before generating or saving files.
- Build execution uses the isolated worker; a successful template selection alone is not sufficient.
- Do not run a database migration or alter production services as part of this branch.
- Existing AI generation remains separate and must not be triggered automatically by the Free path.

## Initial templates

- `landing`: homepage / landing page
- `portfolio`: personal portfolio
- `business`: business or shop information page
- `dashboard`: dashboard-style layout

These are starting prototypes, not full production business applications. More templates and form/data behaviours can be added after this path passes build and ownership tests.

## Acceptance checks

- Valid authenticated request saves files and returns `coreCalls: 0`.
- Missing session returns 401.
- Invalid prompt returns 400.
- Unknown or unowned project returns 404.
- Build failure returns an error and does not save files.
- Generated file count and total bytes remain within worker limits.
- Automated tests pass without a Core key, network request to Core, or Core credits.
- Production stays unchanged until explicit deployment approval.
