# 4N DEV AI App Studio

A clean, mobile-first workspace for creating Web and native Mobile applications with the developer-managed 4N DEV Core model pipeline.

## Product boundaries
- The Builder owns the workspace UI, user projects, generated files, subscription display, and user-facing workflow.
- 4N DEV Core remains the AI engine and source of model availability and usage. End users do not select pipeline models.
- The existing backend owns authentication, project persistence, subscription checks, credits, generation, and build validation.
- Premium generation requires an active paid Builder subscription. Generation is billed through the user's connected 4N DEV Core key by default. Builder Credit reservations and deductions are disabled by default and only activate when `BUILDER_CREDITS_CHARGING_ENABLED=true` is configured with a platform-owned `BUILDER_CORE_API_KEY`.
- Builder Credits and Runtime Credits are separate internal pools. Monthly grants, expiry, rollover, payments, and automatic renewal are not enabled.
- Web projects target React + TypeScript + Vite; native mobile projects target Expo + React Native.
- The UI shows the backend's safe error message instead of replacing it with a generic generation failure.
- GitHub integration is not implemented yet. Pro and Business plans are eligible for it when OAuth, repository synchronization, and secure token management are released; the current entitlement is not a working connection.
- Source files are not considered deployed applications. Project subdomains under 4ndev.dev require a deployment service, DNS automation, TLS, and per-project isolation.

## Authentication protection
Login, registration, and Core-key verification have per-process IP rate limits. When running multiple Builder instances, configure a shared rate limiter at the trusted reverse proxy or API gateway so limits apply across instances.

## Local development
1. Copy .env.example to .env and set VITE_BUILDER_API_URL to the Builder backend URL.
2. Install dependencies with npm ci.
3. Start the API with the documented server environment and npm run start:server.
4. In a second terminal, run npm run dev.
5. Verify with npm run build and npm run test:server.

## Production safety
Never put Core API keys in Vite variables, browser storage, generated source files, or Git. Configure server-only secrets in /etc/4n-dev-ai-builder/builder.env. Do not run database migrations or replace production until build, server tests, generation tests, and rollback procedures have been reviewed. Core API, Console, and N-AI Chat are separate services and must not be changed by Builder deployment work.


## Database migration safety

Before a release, inspect the dedicated Builder database with `npm run db:status`. This command is read-only: it does not create the migration table or apply SQL. If migrations are pending, take and verify a database backup, review the SQL, and run `npm run db:migrate` only as an explicitly approved deployment step. Do not point either command at 4N Core or N-AI Chat databases.

## Mobile validation

The CI pipeline exports the generated Expo app for Android with `expo export --platform android`. This validates the Expo JavaScript bundle; it does not create or sign an APK/AAB. A native binary build and device-level testing remain a separate release gate.
