# Deployment Guide — syncify (apps/web)

## Vercel Project Setup

| Setting | Value |
|---------|-------|
| Framework preset | Next.js |
| Root directory | `apps/web` |
| Build command | `cd ../.. && pnpm build` |
| Install command | `pnpm install` |
| Node.js version | 20.x |

Vercel auto-detects the monorepo structure. The shared package (`packages/shared`) is built as a dependency via Turborepo's `dependsOn: ["^build"]` pipeline.

## Required Environment Variables

### Security & Sessions

| Variable | Required | Notes |
|----------|----------|-------|
| `APPROVAL_COOKIE_SECRET` | Yes | Random 32+ char string. Used to sign approval cookies. |
| `OAUTH_STATE_SECRET` | Yes | Random 32+ char string. Used to sign OAuth state cookies. |
| `OAUTH_SESSION_SECRET` | Yes | Random 32+ char string. Used to sign provider session cookies. |

Generate with: `openssl rand -hex 32`

### App URL

| Variable | Required | Notes |
|----------|----------|-------|
| `APP_BASE_URL` | No | Auto-detected from `VERCEL_URL` on Vercel. Set explicitly for custom domains (e.g. `https://syncify.example.com`). |

### Email (Invite Notifications)

| Variable | Required | Notes |
|----------|----------|-------|
| `EMAIL_PROVIDER` | Yes | `resend` for production, `mock` for dev/preview. |
| `EMAIL_PROVIDER_API_KEY` | Yes (if not mock) | Resend API key from dashboard. |
| `EMAIL_FROM` | Yes (if not mock) | Verified sender address (e.g. `syncify <noreply@yourdomain.com>`). |
| `INVITE_ADMIN_EMAIL` | Yes | Email address that receives invite request notifications. |

### Invite Gating

| Variable | Required | Notes |
|----------|----------|-------|
| `APPROVED_EMAILS` | Yes | Comma-separated list of approved beta user emails (case-insensitive). |
| `INVITE_RATE_LIMIT_WINDOW` | No | Rate limit window in seconds (default: 3600). |
| `INVITE_RATE_LIMIT_MAX` | No | Max requests per window (default: 5). |
| `INVITE_BLOCKED_DOMAINS` | No | Comma-separated list of blocked email domains. |

### Spotify OAuth

| Variable | Required | Notes |
|----------|----------|-------|
| `SPOTIFY_CLIENT_ID` | Yes | From Spotify Developer Dashboard. |
| `SPOTIFY_CLIENT_SECRET` | Yes | From Spotify Developer Dashboard. |
| `SPOTIFY_SCOPES` | No | Default: `playlist-read-private playlist-read-collaborative user-library-read` |

Add your production callback URL to Spotify Dashboard: `https://yourdomain.com/api/auth/spotify/callback`

### TIDAL OAuth

| Variable | Required | Notes |
|----------|----------|-------|
| `TIDAL_CLIENT_ID` | Yes | From TIDAL Developer Portal. |
| `TIDAL_CLIENT_SECRET` | Yes | From TIDAL Developer Portal. |
| `TIDAL_SCOPES` | No | Default: `user.read playlists.read collection.read playlists.write collection.write` |
| `TIDAL_COUNTRY_CODE` | No | Default: `US`. Set to user's country if needed. |

Add your production callback URL to TIDAL Developer Portal: `https://yourdomain.com/api/auth/tidal/callback`

## Resend Domain Verification

The default sender (`onboarding@resend.dev`) works for testing but has sending limits and may land in spam. For production:

1. **Add domain in Resend Dashboard** → Domains → Add Domain
2. **Add DNS records** to your domain registrar:
   - SPF: `TXT` record provided by Resend
   - DKIM: `CNAME` records provided by Resend (usually 3)
   - DMARC: Optional but recommended (`TXT _dmarc.yourdomain.com "v=DMARC1; p=none"`)
3. **Verify** in Resend Dashboard (DNS propagation can take up to 48h)
4. **Update env var**: Set `EMAIL_FROM` to `syncify <noreply@yourdomain.com>`
5. **Test**: Trigger an invite request and verify the admin email arrives

## Pre-Deploy Checklist

- [ ] All three secret env vars set to unique random values (not shared across preview/production)
- [ ] Spotify OAuth callback URL added to Spotify Developer Dashboard
- [ ] TIDAL OAuth callback URL added to TIDAL Developer Portal
- [ ] `APPROVED_EMAILS` contains at least your own email for initial testing
- [ ] `EMAIL_PROVIDER` set to `resend` with valid API key
- [ ] Resend sender domain verified (or using `onboarding@resend.dev` for initial testing)
- [ ] `pnpm build` succeeds locally before deploying
- [ ] `pnpm typecheck` and `pnpm test` pass

## Known Limitations (v1)

- **In-memory rate limiter**: Resets on serverless cold starts. Acceptable for private beta volume. Consider Vercel KV or Upstash Redis if abuse becomes an issue.
- **No persistent transfer history**: Transfer results exist only in the browser session. Refreshing the results page loses data.
- **Cookie-based OAuth sessions**: Session data is stored in signed cookies. Very large session payloads could exceed cookie size limits (4KB), though current payloads are well within this.
- **No token refresh**: If a Spotify or TIDAL access token expires mid-transfer, the user must reconnect and restart. Token lifetimes are typically 1 hour.
