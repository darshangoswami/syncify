# Spotify XYZ Project Spec and TODO

Last updated: 2026-02-08
Owner: Dexter
Status: Active (private beta build)

## 1) Product summary
- Build a web app to transfer user music data from Spotify to TIDAL (and later other providers).
- Current strategy: private beta with manual invite/approval, no persistent database in v1.
- Primary UX promise: cute but clean mobile-first interface, clear onboarding, and strict access gating.

## 2) Scope and constraints
### In scope (v1)
- Invite request flow with email capture.
- Approval check flow using `APPROVED_EMAILS` env allowlist.
- Hard API gating for auth/source/transfer routes until approved.
- Placeholder auth/transfer endpoints with guarded access.
- Production-ready frontend quality baseline and automated tests for invite/approval.

### Out of scope (v1)
- Persistent invite/transfer database.
- Fully implemented Spotify OAuth and TIDAL OAuth.
- Real playlist/liked-song transfer logic.
- Automated allowlist updates in Spotify dashboard.

### Constraints
- Keep architecture simple for fast iteration.
- Keep data retention minimal.
- Preserve private-beta posture and manual review of access.

## 3) Technical architecture
### Monorepo
- `apps/web`: Next.js full-stack app (TypeScript).
- `packages/shared`: shared interfaces and types.
- Tooling: pnpm workspaces + Turborepo.

### Runtime model
- Stateless-ish v1 flow using signed approval cookie and env allowlist.
- Invite request delivery via email provider abstraction (`mock`, `resend`, `postmark`).
- No DB/Redis currently.

## 4) Environment contract
From `/Users/dexter/Developer/spotify-xyz/apps/web/.env.example`:
- `APPROVAL_COOKIE_SECRET`
- `INVITE_ADMIN_EMAIL`
- `EMAIL_PROVIDER` (`mock` | `resend` | `postmark`)
- `EMAIL_PROVIDER_API_KEY`
- `EMAIL_FROM`
- `APPROVED_EMAILS` (comma-separated allowlist)
- `INVITE_RATE_LIMIT_WINDOW`
- `INVITE_RATE_LIMIT_MAX`
- `INVITE_BLOCKED_DOMAINS`
- `INVITE_GATE_PASSPHRASE` (reserved for future use)

## 5) API surface (current)
- `POST /api/invite/request`
  - Validates email
  - Honeypot filter
  - IP/email rate limiting
  - Sends admin email request notification
- `POST /api/invite/check`
  - Checks allowlist membership
  - Sets signed approval cookie for approved users
- Guarded placeholders (403 until approved):
  - `GET /api/auth/[provider]/start`
  - `GET /api/auth/[provider]/callback`
  - `GET /api/source/playlists`
  - `GET /api/source/liked`
  - `POST /api/transfer/preview`
  - `POST /api/transfer/chunk`
  - `POST /api/transfer/finalize`

## 6) Completed so far
- [x] Initial monorepo scaffold (`apps/web`, `packages/shared`, turbo/pnpm config).
- [x] Shared invite and transfer placeholder types.
- [x] Invite request endpoint with validation, honeypot, rate limit, and email provider abstraction.
- [x] Invite approval endpoint with case-insensitive allowlist check and signed cookie.
- [x] Approval middleware / guard applied to auth/source/transfer endpoints.
- [x] Landing page with:
  - [x] `Request Invite` flow
  - [x] `I'm Approved` flow
  - [x] gated connect CTA
  - [x] private-beta compliance/security messaging
- [x] UI redesign iterations completed:
  - [x] cleaner typography and cleaner surfaces
  - [x] motion.dev (`motion/react`) animation integration
- [x] Upgraded to latest stable Next.js at time of upgrade:
  - [x] `next@16.1.6`
  - [x] aligned React and types versions
- [x] Fixed invite UI false-error bug (React event target lifecycle issue in async submit handler).
- [x] Test coverage for key invite/approval behavior.
- [x] `pnpm typecheck` and `pnpm test` passing.

## 7) Pending work (priority order)
## P0 - Core functionality
- [ ] Implement real Spotify OAuth start/callback flow.
- [ ] Implement real TIDAL OAuth start/callback flow.
- [ ] Add provider adapter contract package and concrete Spotify/TIDAL adapters.
- [ ] Implement transfer preview logic (playlist + liked songs inputs).
- [ ] Implement transfer execution logic (chunked add, skip unmatched, result report).
- [ ] Implement deterministic track matching (`ISRC` first, strict metadata fallback).

## P1 - Reliability and UX
- [ ] Add robust API error taxonomy for provider failures/rate limits/token refresh.
- [ ] Add downloadable unmatched report artifact (CSV/JSON).
- [ ] Add progress UX for transfer run state and retries.
- [ ] Add clear empty/loading/error UI states for all transfer screens.

## P1 - Ops and productization
- [ ] Configure and verify Resend production sender domain.
- [ ] Add Vercel env configuration checklist (preview + production).
- [ ] Add request-id correlation and sanitized logging for auth/transfer flows.
- [ ] Add smoke E2E test for invite -> approval -> guarded auth route.

## P2 - Future roadmap
- [ ] Replace env allowlist with lightweight persistent invite table when volume grows.
- [ ] Add admin invite dashboard (`pending/approved/rejected`) once DB is introduced.
- [ ] Add AI-assisted invite triage workflow (prepare approval batches, human-review final).
- [ ] Add support for additional destination providers via adapter pattern.

## 8) Quality gates
- [ ] `pnpm typecheck` passes.
- [ ] `pnpm test` passes.
- [ ] Manual flow check passes:
  - [ ] Invite request returns success.
  - [ ] Approved email enables connect flow.
  - [ ] Unapproved email remains blocked.
  - [ ] Guarded route returns 403 before approval, 200 after approval.

## 9) How to maintain this file
- This file is the source-of-truth task tracker.
- On every functional, API, infra, or UX change:
  - Update `Last updated` date.
  - Mark completed items in sections 6/7/8.
  - Add/remove pending tasks as needed.
  - Append one line in section 10 change log.
- Keep pending items explicitly actionable (one task per checkbox).

## 10) Change log
- 2026-02-08: Created initial full project spec/todo tracker with completed and pending roadmap.
