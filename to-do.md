# Spotify XYZ Project Spec and TODO

Last updated: 2026-02-09
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
- Real Spotify/TIDAL OAuth start/callback flows with guarded access.
- Transfer preview with deterministic matching; transfer execution endpoints still placeholder.
- Production-ready frontend quality baseline and automated tests for invite/approval.

### Out of scope (v1)
- Persistent invite/transfer database.
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
- `OAUTH_STATE_SECRET`
- `OAUTH_SESSION_SECRET`
- `APP_BASE_URL`
- `INVITE_ADMIN_EMAIL`
- `EMAIL_PROVIDER` (`mock` | `resend` | `postmark`)
- `EMAIL_PROVIDER_API_KEY`
- `EMAIL_FROM`
- `APPROVED_EMAILS` (comma-separated allowlist)
- `INVITE_RATE_LIMIT_WINDOW`
- `INVITE_RATE_LIMIT_MAX`
- `INVITE_BLOCKED_DOMAINS`
- `INVITE_GATE_PASSPHRASE` (reserved for future use)
- `SPOTIFY_CLIENT_ID`
- `SPOTIFY_CLIENT_SECRET`
- `SPOTIFY_SCOPES`
- `SPOTIFY_AUTHORIZATION_URL`
- `SPOTIFY_TOKEN_URL`
- `SPOTIFY_API_BASE_URL`
- `TIDAL_CLIENT_ID`
- `TIDAL_CLIENT_SECRET`
- `TIDAL_SCOPES`
- `TIDAL_AUTHORIZATION_URL`
- `TIDAL_TOKEN_URL`
- `TIDAL_API_BASE_URL`
- `TIDAL_SEARCH_URL_TEMPLATE`
- `TIDAL_COUNTRY_CODE`

## 5) API surface (current)
- `POST /api/invite/request`
  - Validates email
  - Honeypot filter
  - IP/email rate limiting
  - Sends admin email request notification
- `POST /api/invite/check`
  - Checks allowlist membership
  - Sets signed approval cookie for approved users
- Guarded routes (403 until approved):
  - `GET /api/auth/[provider]/start`
  - `GET /api/auth/[provider]/callback`
  - Auth endpoints execute provider OAuth start/callback flows (TIDAL uses PKCE).
  - Local dev OAuth callback URLs canonicalize to loopback host (`127.0.0.1`) for provider compatibility.
  - `GET /api/source/playlists`
  - `GET /api/source/liked`
  - Source endpoints now return Spotify data for approved users with valid provider sessions.
  - `POST /api/transfer/preview`
  - Preview endpoint now runs Spotify-source to TIDAL-destination deterministic matching.
  - Remaining placeholder responses:
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
  - [x] simple/elegant banking-style pass inspired by Rebank (clean two-step panels, restrained cobalt accents, softer shadows)
  - [x] dark theme redesign inspired by Rebank fintech aesthetic (deep `#07080d` background, purple `#7c6bf5` accents, glassmorphic cards, gradient typography, hero glow, sticky frosted nav bar)
  - [x] font refresh to `Sora` (display) + `Source Sans 3` (body)
  - [x] Playwright-driven visual iteration loop (desktop + mobile screenshot validation)
- [x] Upgraded to latest stable Next.js at time of upgrade:
  - [x] `next@16.1.6`
  - [x] aligned React and types versions
- [x] Fixed invite UI false-error bug (React event target lifecycle issue in async submit handler).
- [x] Test coverage for key invite/approval behavior.
- [x] `pnpm typecheck` and `pnpm test` passing.
- [x] Transfer preview backend slice (Spotify source reads + TIDAL destination matching with deterministic rules).
- [x] OAuth reliability hardening:
  - [x] local callback host canonicalization for Spotify/TIDAL (`localhost` -> `127.0.0.1` where required)
  - [x] TIDAL PKCE support in auth start/callback + token exchange
  - [x] updated TIDAL OAuth defaults/scopes to current-compatible values (`login.tidal.com/authorize`, read-focused scopes)
- [x] Approval step UI now includes provider-specific connect CTAs (`Connect Spotify`, `Connect TIDAL`).
- [x] Resolved hydration mismatch in connect CTA by keeping SSR/CSR `href` stable.

## 7) Pending work (priority order)
## P0 - Core functionality
- [x] Implement real Spotify OAuth start/callback flow.
- [x] Implement real TIDAL OAuth start/callback flow.
- [x] Add provider adapter contract package and concrete Spotify/TIDAL adapters.
- [x] Implement transfer preview logic (playlist + liked songs inputs).
- [ ] Implement transfer execution logic (chunked add, skip unmatched, result report).
- [x] Implement deterministic track matching (`ISRC` first, strict metadata fallback).
- [ ] Add write-capable TIDAL scopes and re-consent path when transfer execution is implemented.

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
- [x] `pnpm typecheck` passes.
- [x] `pnpm test` passes.
- [x] Manual flow check passes:
  - [x] Invite request returns success.
  - [x] Approved email enables connect flow.
  - [x] Unapproved email remains blocked.
  - [x] Guarded route returns 403 before approval, 200 after approval.

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
- 2026-02-08: Added simple/elegant landing-page redesign updates (including font/palette/layout changes), recorded Playwright desktop+mobile validation, and marked typecheck/test quality gates complete.
- 2026-02-08: Implemented OAuth adapter contract plus real Spotify/TIDAL auth start/callback flows with signed state/session cookies.
- 2026-02-08: Stopped tracking generated TypeScript build artifacts (`*.tsbuildinfo`) to keep git status clean after local typecheck runs.
- 2026-02-08: Dark theme redesign of landing page inspired by Rebank (PR #3 on `claude/work` branch): replaced light theme with dark UI, added sticky nav, hero glow, glassmorphic cards, purple accent system, and gradient typography via 5-iteration Playwright loop.
- 2026-02-09: Completed manual quality-gate flow checks for invite success, approval gating, and guarded route 403/200 behavior.
- 2026-02-09: Implemented transfer preview backend slice with Spotify source reads, TIDAL destination matching, provider-session gating, and new route + matcher tests.
- 2026-02-09: Added dual provider connect CTAs on landing (`Connect Spotify` + `Connect TIDAL`) and fixed connect-link hydration mismatch.
- 2026-02-09: Hardened local OAuth host behavior by canonicalizing callback origin for Spotify/TIDAL compatibility with provider redirect constraints.
- 2026-02-09: Updated TIDAL OAuth integration to use PKCE and current authorization defaults/scopes, resolving login/authorization flow issues.
