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

The backend currently uses Node.js built-ins only. It defaults to binding on loopback for safer local development. Production deployment must configure a private upstream listener/reverse proxy, TLS, exact allowed origins, authentication, persistent storage and rate limits before enabling generation/build operations.

## Canonical model IDs

- `4n-chat-naya-5.6` — 4N Chat Naya 5.6 (Luna)
- `4n-chat-naya-6` — 4N Chat Naya 6 (Luna)
- `4n-code-nael-5.6` — 4N Code Nael 5.6 (Sol)
- `4n-code-nael-6.1` — 4N Code Nael 6.1 (Sol)

No Astra model is included.
