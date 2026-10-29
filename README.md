# 4N DEV AI App Studio

A clean, mobile-first workspace for creating Web and native Mobile applications with the developer-managed 4N DEV Core model pipeline.

## Product boundaries
- The Builder owns the workspace UI, user projects, generated files, subscription display, and user-facing workflow.
- 4N DEV Core remains the AI engine and source of model availability and usage. End users do not select pipeline models.
- The existing backend owns authentication, project persistence, subscription checks, credits, generation, and build validation.
- Premium generation requires an active paid Builder subscription and sufficient Builder credits. Core balance and usage are separate and remain managed by Core.
- Web projects target React + TypeScript + Vite; native mobile projects target Expo + React Native.
- The UI shows the backend's safe error message instead of replacing it with a generic generation failure.
- Source files are not considered deployed applications. Project subdomains under 4ndev.dev require a deployment service, DNS automation, TLS, and per-project isolation.

## Local development
1. Copy .env.example to .env and set VITE_BUILDER_API_URL to the Builder backend URL.
2. Install dependencies with npm ci.
3. Start the API with the documented server environment and npm run start:server.
4. In a second terminal, run npm run dev.
5. Verify with npm run build and npm run test:server.

## Production safety
Never put Core API keys in Vite variables, browser storage, generated source files, or Git. Configure server-only secrets in /etc/4n-dev-ai-builder/builder.env. Do not run database migrations or replace production until build, server tests, generation tests, and rollback procedures have been reviewed. Core API, Console, and N-AI Chat are separate services and must not be changed by Builder deployment work.
