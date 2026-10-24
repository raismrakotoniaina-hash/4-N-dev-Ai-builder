# 4N DEV AI Builder

Mobile-friendly AI application builder powered by 4N DEV Core.

## Current architecture

- `src/` contains the React/Vite browser application.
- `server/` contains the separate Node.js backend.
- The backend reads the Core model catalogue from `CORE_API_URL/v1/models` and exposes only the four canonical public Builder models through `GET /api/models`.
- The Core API key is not sent to the browser. AI generation endpoints are intentionally not enabled in this foundation step; authentication, project persistence, usage limits and billing must be designed before any paid Core operation is proxied.

## Local development

Requirements: Node.js 20 or later.

1. Install dependencies: `npm ci`
2. Start the browser app: `npm run dev`
3. In another terminal, configure `.env` using `.env.example` as a guide, then start the backend: `npm run start:server`
4. Check backend health: `GET http://127.0.0.1:8787/health`
5. Check models: `GET http://127.0.0.1:8787/api/models`
6. Run backend tests: `npm run test:server`

The backend uses Node.js built-ins and the `pg` PostgreSQL driver. It defaults to binding on loopback for safer local development.

## Authentication and persistence foundation

- POST /api/auth/register and POST /api/auth/login create password-hashed accounts and HttpOnly, SameSite=Lax sessions; POST /api/auth/logout clears the session and GET /api/auth/me checks it.
- POST /api/core/connect verifies a user's 4ndev_sk against https://api.4ndev.dev/v1/credits before storing it encrypted with AES-256-GCM. GET /api/core/credits retrieves that user's Core balance directly from Core; Builder does not calculate or own the balance.
- GET/POST /api/projects, GET/PATCH/DELETE /api/projects/:id, and PUT/DELETE /api/projects/:id/files store projects and files and enforce per-account ownership.
- Set BUILDER_ENCRYPTION_KEY to a strong random secret (at least 32 bytes) before connecting Core keys. Set BUILDER_DATA_FILE to a private writable path on persistent storage. Never commit either secret or the data file.
- PostgreSQL persistence is now implemented as an opt-in backend. Set `DATABASE_URL` to a **dedicated AI Builder database** and set `BUILDER_ENCRYPTION_KEY` before starting the backend. Do not point it at the Core database. The JSON adapter remains only as a local development fallback when `DATABASE_URL` is empty.

- Review `server/migrations/001_initial_builder_schema.sql` before applying it.
- Run `npm run db:migrate` explicitly to create/update the Builder schema. The server does not automatically run migrations at startup.
- The PostgreSQL adapter stores password hashes, hashed session tokens, encrypted Core keys, projects and files in separate tables, with foreign keys and per-user ownership checks.
- Before production deployment, add rate limiting, email verification/password reset, a final CSRF/domain review, database backups/monitoring and a sandboxed build-execution design.
- Never put the database password or `BUILDER_ENCRYPTION_KEY` in the browser, `VITE_*` variables, or Git.
- AI generation, sandboxed builds, tests, repair and previews remain disabled until the production persistence/security review and a safe build-execution design are completed.

The backend defaults to binding on loopback. Production deployment must configure a private upstream listener/reverse proxy, TLS and exact allowed origins. No deployment or VPS changes are performed by these code changes.

## Canonical model IDs

- `4n-chat-naya-5.6` — 4N Chat Naya 5.6 (Luna)
- `4n-chat-naya-6` — 4N Chat Naya 6 (Luna)
- `4n-code-nael-5.6` — 4N Code Nael 5.6 (Sol)
- `4n-code-nael-6.1` — 4N Code Nael 6.1 (Sol)

No Astra model is included.
