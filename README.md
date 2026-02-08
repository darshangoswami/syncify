# Spotify XYZ

Monorepo for a private-beta music transfer app.

## Apps

- `apps/web`: Next.js full-stack React app (TypeScript)
- `packages/shared`: shared types/interfaces for invite and transfer surfaces

## Quick start

1. Install dependencies:
   - `corepack enable`
   - `corepack prepare pnpm@9.15.0 --activate`
   - `pnpm install`
2. Copy env file:
   - `cp apps/web/.env.example apps/web/.env.local`
3. Run app:
   - `pnpm dev`
4. Run tests:
   - `pnpm test`

## Invite + approval flow

- Landing page has `Request Invite` and `I'm Approved` actions.
- `POST /api/invite/request` validates email, rate-limits by IP/email, honeypot-checks, and sends an admin email.
- `POST /api/invite/check` verifies allowlist membership from `APPROVED_EMAILS` and sets an approval cookie.
- Protected API routes verify approval cookie before auth/transfer/source actions.

## Security notes

- No persistent DB/Redis in v1.
- OAuth/transfer routes are blocked until approval.
- Invite logs are minimal (`requestId`, `status`, timestamp).
