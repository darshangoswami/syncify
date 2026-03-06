# Bug Fixes & Improvements — Full Repo Review

## CRITICAL: Cross-User Data Leak — `cachedUserId`

**File:** `apps/web/lib/providers/tidal-write.ts`

**What happens:** A module-level `let cachedUserId` caches the first caller's TIDAL user ID. In Vercel's serverless model, warm function instances persist module state across HTTP requests. When User B hits the same warm instance that User A already populated, User B gets User A's cached TIDAL user ID. All of User B's tracks and playlists are then written to User A's TIDAL account.

**Fix:** Removed `let cachedUserId` and the `if (cachedUserId) return cachedUserId;` check. Each request calls `/users/me` once — adds ~100ms per request but eliminates the data leak.

**Status:** ✅ Fixed

---

## SECURITY: `isApprovedEmail` Timing Leak

**File:** `apps/web/lib/invite.ts`

**What happens:** `.some()` short-circuits on first match. An attacker measuring response times can infer their position in the allowlist, or whether they're in it at all — partially defeating the `constantTimeEquals` protection.

**Fix:** Replaced with a full loop that iterates all entries, pre-computes the left digest once (halving SHA-256 work).

**Status:** ✅ Fixed

---

## SECURITY: Missing `ensureMinimumDuration` on Invite Error Path

**File:** `apps/web/app/api/invite/request/route.ts`

**What happens:** When `sendInviteEmail` throws, the handler returns immediately without calling `await ensureMinimumDuration(startedAt)`. Every other branch applies the timing normalization.

**Fix:** Added `await ensureMinimumDuration(startedAt);` before the 503 return.

**Status:** ✅ Fixed

---

## HIGH: `approval-cookie.ts` Duplicates `signed-payload.ts`

**Files:** `apps/web/lib/approval-cookie.ts`, `apps/web/lib/signed-payload.ts`

**What happens:** `approval-cookie.ts` had its own `sign()`, `createApprovalCookieValue()`, and `readApprovalCookieValue()` that were functionally identical to `signed-payload.ts`.

**Fix:** Rewrote `approval-cookie.ts` to delegate to `createSignedPayload` and `readSignedPayload`. Kept `getApprovalCookieName()` and `getApprovalCookieMaxAge()` unchanged.

**Status:** ✅ Fixed

---

## HIGH: Rate Limiter Memory Leak

**File:** `apps/web/lib/rate-limit.ts`

**What happens:** The `timestampsByKey` Map grows without bound. Keys with expired timestamps that are never accessed again remain in the Map forever.

**Fix:** Not fixed in this pass. The in-code lazy cleanup approach doesn't work because every access records a new timestamp (so keys are never truly empty). A real fix requires periodic sweep or max-size eviction, which is out of scope for v1 (intentional per `to-do.md` line 40: "No DB/Redis currently").

**Status:** ⏭️ Deferred — requires periodic cleanup mechanism

---

## HIGH: `listTidalUserPlaylists` Silently Swallows All Errors

**File:** `apps/web/lib/providers/tidal-catalog.ts`

**What happens:** A catch-all returns `[]`, making failures indistinguishable from "user has no playlists."

**Fix:** Added `console.error` with structured JSON logging inside the catch block. Preserves graceful degradation while making failures observable.

**Status:** ✅ Fixed

---

## EFFICIENCY: `matchResults.filter()` is O(n) Per Playlist

**File:** `apps/web/app/api/transfer/preview/route.ts`

**Fix:** Pre-grouped `matchResults` into a `Map<string, ...>` before the breakdown loop. O(n) total instead of O(n × playlists).

**Status:** ✅ Fixed

---

## EFFICIENCY: `normalizeText` Recomputed Redundantly in Matching

**File:** `apps/web/lib/transfer-matcher.ts`

**Fix:** Pre-computed `srcTitle`/`srcArtist` for the source track once. Pre-computed `normalized` array of candidate title/artist values once, shared across tiers 2–4 (was re-normalizing each candidate per tier).

**Status:** ✅ Fixed

---

## CODE DEDUP: `getAuthHeader()` / `getString()` / `getNumber()` / `delay()`

**Files:** `spotify-catalog.ts`, `tidal-catalog.ts`, `tidal-write.ts`

**Fix:** Extracted to `lib/providers/shared.ts` and imported in all three files.

**Status:** ✅ Fixed

---

## CODE DEDUP: TIDAL Retry Logic

**Files:** `tidal-catalog.ts` (`fetchWithRetry`), `tidal-write.ts` (`postWithRetry`)

**Fix:** Unified into `tidalFetchWithRetry(url, session, options, init?)` in `lib/providers/shared.ts`. Both files now wrap this shared function.

**Status:** ✅ Fixed

---

## CODE DEDUP: API Error Classes

**Files:** `spotify-catalog.ts`, `tidal-catalog.ts`, `tidal-write.ts`

**Fix:** Extracted `ProviderApiError` to `lib/providers/errors.ts`. All three error classes now extend it.

**Status:** ✅ Fixed

---

## CODE DEDUP: `normalizeBaseUrl` / `normalizeOrigin`

**Files:** `lib/env.ts`, `lib/providers/index.ts`

**Fix:** Exported `normalizeBaseUrl` from `env.ts`, removed `normalizeOrigin` from `providers/index.ts`.

**Status:** ✅ Fixed

---

## CODE DEDUP: `CACHE_KEY`

**Files:** `select-sources/page.tsx`, `done/page.tsx`

**Fix:** Extracted `LIBRARY_CACHE_KEY` to `lib/constants.ts` and imported in both pages.

**Status:** ✅ Fixed

---

## SIMPLIFY REVIEW: Additional Fixes

Found during post-implementation code review:

1. **Header merge vulnerability in `shared.ts`** — Reversed spread order so `Authorization` always comes last, preventing callers from accidentally overriding it via `init.headers`.
2. **Candidate normalization repeated 3x in `transfer-matcher.ts`** — Pre-computed `normalized` array of candidate title/artist values once, shared across tiers 2–4.

---

## INTENTIONALLY SKIPPED

| Finding | Why skipping |
|---------|-------------|
| 250ms/500ms throttle before first TIDAL request | Intentional — prevents 429 rate limits from TIDAL API |
| `finalize/route.ts` placeholder | Intentional — finalize not needed, results accumulated client-side |
| In-memory rate limiter resets on cold start | Intentional for v1 — no DB/Redis currently |
| Sequential preview fetches from client | Intentional — avoids Vercel 300s function timeout |
| `handleConnectClick` alongside `CanonicalHostGuard` | Defense-in-depth |
| `skipped` variable always 0 in chunk route | Placeholder for future skip logic |
| Loading spinner duplicated 4x | UI-only, no correctness impact |
| Transfer page 1089-line monolith | Architectural, high refactor risk, no bug |
| `env.ts` functions re-parse on every call | Micro-optimization — string split/trim is cheap |
| Missing `useMemo` in select-sources | Minor, only matters for very large libraries |
| `createOAuthStateCookieValue` has 5 params | Code smell but not a bug |
| `OAuthTokenExchangeError` not extending `ProviderApiError` | Existing code not touched in this diff |
