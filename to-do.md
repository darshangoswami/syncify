# Spotify XYZ Project Spec and TODO

Last updated: 2026-02-11
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
- Transfer preview with deterministic matching and transfer execution with chunked TIDAL writes.
- Production-ready frontend quality baseline and automated tests for invite/approval.

### Out of scope (v1)
- Persistent invite/transfer database.
- Persistent transfer history/retry from saved state.
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
  - `POST /api/transfer/chunk`
  - Chunk endpoint executes real TIDAL writes: creates playlists, adds tracks in batches, adds to favorites for liked songs.
  - `POST /api/transfer/finalize`
  - Placeholder (finalize not needed — results accumulated client-side).
- `GET /api/status`
  - Returns `{ approved, spotifyConnected, tidalConnected }` based on signed cookies

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
- [x] Full UI redesign from design mockups (Tailwind CSS + Plus Jakarta Sans + Material Icons):
  - [x] Multi-page routing: `/` (landing), `/request-invite`, `/connections`, `/select-sources`
  - [x] Public landing access gate with "syncify" branding, request invite CTA, already approved CTA
  - [x] Request invite flow page with email form, success state, and back navigation
  - [x] Provider connections page with approval check, Spotify/TIDAL OAuth cards, connected states
  - [x] Select music sources page wired to real Spotify API (fetches all playlists + liked songs count)
  - [x] `GET /api/status` endpoint for checking approval + provider connection status
  - [x] OAuth callback now redirects to `/connections` instead of `/`
  - [x] Replaced custom CSS with Tailwind CSS v4 (`@tailwindcss/postcss`)
  - [x] Switched fonts from Sora/Source Sans 3 to Plus Jakarta Sans
  - [x] Localhost canonicalization extracted to shared `CanonicalHostGuard` component
- [x] Transfer execution feature (full flow):
  - [x] Enhanced preview endpoint with per-playlist breakdowns and matched TIDAL track IDs
  - [x] TIDAL write functions (create playlist, add tracks, add to favorites)
  - [x] Real chunk endpoint with TIDAL write logic (batched adds, per-track error handling)
  - [x] Updated TIDAL OAuth default scopes to include `playlists.write`, `collection.write`
  - [x] New shared types: `TransferMatchedTrack`, `TransferPreviewPlaylistBreakdown`, `TransferPreviewResultV2`, updated `TransferChunkRequest`/`TransferChunkResult`
  - [x] `/transfer` page with three-phase state machine (preview, progress, results)
  - [x] Transfer preview screen with hero card, per-playlist breakdown, unmatched warning
  - [x] Live transfer progress screen with circular progress, current track display, stop button, estimated time
  - [x] Transfer results screen with 2x2 stats grid, match rate bar, unmatched text box with copy button
  - [x] Wired select-sources "Transfer to TIDAL" button to navigate to `/transfer` with selected playlists
  - [x] Error handling: 401 session expiry, 429 rate limit retry with exponential backoff, per-track failure recording
  - [x] Cancellation support: "Stop Transfer" preserves partial results
  - [x] Fixed TIDAL search API integration (correct endpoint, rate limiting, response parsing):
    - [x] Corrected search endpoint to `openapi.tidal.com/v2/searchResults/{query}/relationships/tracks`
    - [x] Added 250ms throttle + exponential backoff retry (up to 4 retries) for 429 rate limits
    - [x] Parse ISO 8601 duration format (`PT3M38S`) from TIDAL API responses
    - [x] Extract artist names from JSON:API `relationships` (not `attributes`)
    - [x] Handle numeric track IDs from JSON:API compound documents
    - [x] Prefer `included` array over `data` for full track resources with attributes
  - [x] Fixed TIDAL write API integration:
    - [x] Corrected playlist creation attribute from `title` to `name` per TIDAL API spec
    - [x] Fixed favorites endpoint to use `/userCollections/{userId}/relationships/tracks` with `GET /users/me` lookup
    - [x] Reduced chunk size from 25 to 20 (TIDAL max per batch request)
  - [x] Batch ISRC lookup optimization for large libraries:
    - [x] Added `lookupTidalTracksByIsrc()` using `GET /tracks?filter[isrc]=...` (20 ISRCs per batch)
    - [x] Preview now uses two-phase matching: batch ISRC lookup first, search fallback only for unmatched
    - [x] Reduced API calls from ~N (one per track) to ~N/20 + few search fallbacks
    - [x] Extracted shared `fetchWithRetry()` helper with throttle + exponential backoff
- [x] Deploy readiness:
  - [x] Structured request-ID logging (`logApiEvent`/`logApiError`) on all guarded API routes
  - [x] `getRequestId()` helper propagating Vercel `x-request-id` header
  - [x] Updated EMAIL_FROM default to `syncify` branding
  - [x] Created `apps/web/DEPLOY.md` with Vercel setup, env checklist, Resend domain verification guide

## 7) Pending work (priority order)
## P0 - Core functionality
- [x] Implement real Spotify OAuth start/callback flow.
- [x] Implement real TIDAL OAuth start/callback flow.
- [x] Add provider adapter contract package and concrete Spotify/TIDAL adapters.
- [x] Implement transfer preview logic (playlist + liked songs inputs).
- [x] Implement transfer execution logic (chunked add, skip unmatched, result report).
- [x] Implement deterministic track matching (`ISRC` first, strict metadata fallback).
- [x] Add write-capable TIDAL scopes and re-consent path when transfer execution is implemented.

## P1 - Reliability and UX
- [ ] Add robust API error taxonomy for provider failures/rate limits/token refresh.
- [x] Add unmatched report with copy-to-clipboard (text box instead of CSV).
- [x] Add progress UX for transfer run state and retries.
- [x] Add clear empty/loading/error UI states for all transfer screens.

## P1 - Ops and productization
- [x] Configure and verify Resend production sender domain.
- [x] Add Vercel env configuration checklist (preview + production).
- [x] Add request-id correlation and sanitized logging for auth/transfer flows.
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
- 2026-02-10: Full UI redesign from design mockups: replaced single-page custom CSS UI with multi-page Tailwind CSS app (landing, request-invite, connections, select-sources), added `/api/status` endpoint, switched to Plus Jakarta Sans + Material Icons, updated OAuth callback redirect to `/connections`.
- 2026-02-10: Wired select-sources page to real Spotify API: fetches all user playlists + liked songs count, removed mock data and syncing animation, added loading/error states.
- 2026-02-09: Transfer execution feature: enhanced preview with per-playlist breakdowns + matched TIDAL track IDs, created TIDAL write functions (playlist creation, track adding, favorites), implemented real chunk endpoint, built `/transfer` page with three-phase UI (preview summary, live progress with circular indicator, results with stats grid and unmatched text box + copy), added TIDAL write scopes, wired select-sources transfer button, added error handling (session expiry, rate limit retry, cancellation).
- 2026-02-09: Fixed TIDAL search API integration: corrected endpoint path (`searchResults` camelCase + `/relationships/tracks`), added request throttling (250ms) and exponential backoff retry for 429 rate limits, parsed ISO 8601 durations, extracted artist names from JSON:API relationships, handled numeric IDs and compound document `included` array. Improved match rate from ~16% to ~82%.
- 2026-02-09: Fixed TIDAL write API: corrected playlist creation attribute (`name` not `title`), fixed favorites to use `/userCollections/{userId}/relationships/tracks` with `/users/me` lookup, reduced chunk size from 25 to 20 to match TIDAL batch limit. Transfer now completes successfully end-to-end.
- 2026-02-09: Batch ISRC lookup optimization: preview now resolves tracks via `GET /tracks?filter[isrc]=...` in batches of 20, with search fallback only for tracks without ISRC or not found. Reduced 2000+ API calls to ~100 batch calls for large libraries.
- 2026-02-09: Fixed TIDAL write rate limiting: added `postWithRetry` with 500ms throttle + exponential backoff (2s/4s/8s/16s, 4 retries) to all write operations, cached `/users/me` result to avoid repeated lookups, switched favorites from per-track to batch adds matching playlist pattern.
- 2026-02-09: Improved track matching accuracy: increased duration tolerance from 2s to 10s, added 4-tier matching (ISRC → strict metadata → relaxed with fuzzy title/partial artist → search-context with unknown artist tolerance), handles platform differences in track names, artist spellings, and missing metadata.
- 2026-02-09: Added duplicate track count display: preview shows "{N} duplicates removed" note below hero card, results screen shows same note above stats grid and relabeled "Total" to "Unique Tracks" for clarity. Added `duplicatesRemoved` field to `TransferPreviewResultV2`.
- 2026-02-09: Added "Allow duplicate tracks" checkbox on select-sources page, passed as `dupes` URL param to transfer page. Preview and results screens show full track accounting note (`{total} total · {N} unavailable · {N} duplicates removed` or `duplicates included`). Added `unavailableTracks` to `TransferPreviewResultV2` to surface tracks filtered by Spotify (local files, deleted, podcasts). Updated Spotify catalog functions to return `totalItemsSeen` alongside tracks for accurate accounting.
- 2026-02-10: Deploy readiness: added structured request-ID logging (`logApiEvent`/`logApiError`) to all guarded API routes (transfer/preview, transfer/chunk, source/playlists, source/liked, auth start, auth callback) with sanitized output (no tokens/secrets). Added `getRequestId()` helper that propagates Vercel's `x-request-id` header. Updated EMAIL_FROM default to `syncify` branding. Created `apps/web/DEPLOY.md` with Vercel project setup, full env var checklist, Resend domain verification steps, and v1 known limitations.
- 2026-02-10: UI polish: removed version pill and disabled "Connect Providers" button from landing page, updated connections footer to "Secured by OAuth 2.0 + PKCE". Fixed all pages to use viewport-relative sizing (`h-dvh`/`min-h-dvh`, `w-full max-w-100`) instead of hardcoded pixel dimensions (`w-[375px] h-[812px]`), ensuring screens fit any mobile device.
- 2026-02-10: UI polish round 2: landing page — removed "Join 12k+ others" text, removed fixed height on Request Invite card, moved arrow button inline with title, fixed Waitlist pill width (`self-start`), updated "Already Approved?" subtitle to "Sign in with your approved email". Request invite page — removed Terms of Service/Privacy Policy fine print.
- 2026-02-10: Added sessionStorage caching for Spotify playlist data on select-sources page (5-min TTL). Back navigation and "Start Another Transfer" now load instantly from cache instead of re-fetching from Spotify API. Added refresh button in header to manually clear cache and re-fetch library.
- 2026-02-10: Fixed Vercel 300s timeout issue for large libraries: transfer preview now fetches playlists sequentially (one at a time) instead of all at once. Each request stays under 90s (safe), preview shows incremental progress "Preparing preview... (3/6) My Workout Playlist". Added `filterPlaylistId` parameter to `/api/transfer/preview` endpoint and updated client to aggregate results from multiple preview calls. Solves timeout for users with 5k+ tracks across many playlists.
- 2026-02-11: Fixed iOS Chrome over-scroll issue: switched page wrappers to `fixed inset-0` positioning (standard mobile web app pattern) with `h-full` inner containers instead of viewport-relative `h-dvh`/`min-h-dvh`. Removed `min-h-screen` from body. Added global `overscroll-behavior: none` to prevent rubber-band bouncing. Pages now lock to visible viewport without blocking internal `overflow-y-auto` scroll containers.
- 2026-02-11: Transfer results page redesign + done/goodbye page: rearranged bottom buttons to side-by-side layout (Copy Report + New Transfer) with "I'm done" button below. Created `/done` goodbye page with "Delete my data" red button (idle → spinner → "Deleted" checkmark), "Buy me a coffee?" link in Gochi Hand handwriting font, "Need another Transfer?" link at bottom, and decorative floating stickers. Added `POST /api/auth/delete` endpoint that clears all user cookies (approval + OAuth sessions) and sessionStorage cache. Added Gochi Hand font via `next/font/google` with `--font-handwriting` CSS variable.
