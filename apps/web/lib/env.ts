const DEFAULT_RATE_WINDOW_SECONDS = 3600;
const DEFAULT_RATE_LIMIT_MAX = 5;

function asNumber(value: string | undefined, fallback: number): number {
  if (!value) {
    return fallback;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function asCsv(value: string | undefined): string[] {
  if (!value) {
    return [];
  }

  return value
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
}

function asScopes(value: string | undefined, fallback: string[]): string[] {
  if (!value) {
    return fallback;
  }

  return value
    .split(/[,\s]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeBaseUrl(value: string): string {
  return value.endsWith("/") ? value.slice(0, -1) : value;
}

export function getRateLimitWindowSeconds(): number {
  return asNumber(process.env.INVITE_RATE_LIMIT_WINDOW, DEFAULT_RATE_WINDOW_SECONDS);
}

export function getRateLimitMax(): number {
  return asNumber(process.env.INVITE_RATE_LIMIT_MAX, DEFAULT_RATE_LIMIT_MAX);
}

export function getBlockedDomains(): string[] {
  return asCsv(process.env.INVITE_BLOCKED_DOMAINS);
}

export function getApprovedEmails(): string[] {
  return asCsv(process.env.APPROVED_EMAILS);
}

export function getApprovalCookieSecret(): string {
  return process.env.APPROVAL_COOKIE_SECRET || "local-dev-insecure-secret";
}

export function getInviteAdminEmail(): string {
  return process.env.INVITE_ADMIN_EMAIL || "";
}

export function getEmailProvider(): "mock" | "resend" | "postmark" {
  const value = (process.env.EMAIL_PROVIDER || "mock").toLowerCase();
  if (value === "resend" || value === "postmark") {
    return value;
  }

  return "mock";
}

export function getEmailProviderApiKey(): string {
  return process.env.EMAIL_PROVIDER_API_KEY || "";
}

export function getEmailFrom(): string {
  return process.env.EMAIL_FROM || "Spotify XYZ <noreply@example.com>";
}

export function getAppBaseUrl(): string {
  const configured = process.env.APP_BASE_URL || process.env.NEXT_PUBLIC_APP_BASE_URL;
  if (configured) {
    return normalizeBaseUrl(configured);
  }

  const vercelUrl = process.env.VERCEL_URL;
  if (vercelUrl) {
    return normalizeBaseUrl(`https://${vercelUrl}`);
  }

  return "http://localhost:3000";
}

export function getOAuthStateSecret(): string {
  return process.env.OAUTH_STATE_SECRET || getApprovalCookieSecret();
}

export function getOAuthSessionSecret(): string {
  return process.env.OAUTH_SESSION_SECRET || getApprovalCookieSecret();
}

export interface ProviderOAuthConfig {
  clientId: string;
  clientSecret: string;
  authorizationUrl: string;
  tokenUrl: string;
  scopes: string[];
}

export interface ProviderApiConfig {
  apiBaseUrl: string;
}

export function getSpotifyOAuthConfig(): ProviderOAuthConfig {
  return {
    clientId: process.env.SPOTIFY_CLIENT_ID || "",
    clientSecret: process.env.SPOTIFY_CLIENT_SECRET || "",
    authorizationUrl: process.env.SPOTIFY_AUTHORIZATION_URL || "https://accounts.spotify.com/authorize",
    tokenUrl: process.env.SPOTIFY_TOKEN_URL || "https://accounts.spotify.com/api/token",
    scopes: asScopes(process.env.SPOTIFY_SCOPES, [
      "playlist-read-private",
      "playlist-read-collaborative",
      "user-library-read"
    ])
  };
}

export function getTidalOAuthConfig(): ProviderOAuthConfig {
  return {
    clientId: process.env.TIDAL_CLIENT_ID || "",
    clientSecret: process.env.TIDAL_CLIENT_SECRET || "",
    authorizationUrl: process.env.TIDAL_AUTHORIZATION_URL || "https://login.tidal.com/authorize",
    tokenUrl: process.env.TIDAL_TOKEN_URL || "https://auth.tidal.com/v1/oauth2/token",
    scopes: asScopes(process.env.TIDAL_SCOPES, [
      "user.read",
      "playlists.read",
      "collection.read",
      "playlists.write",
      "collection.write"
    ])
  };
}

export function getSpotifyApiConfig(): ProviderApiConfig {
  return {
    apiBaseUrl: normalizeBaseUrl(process.env.SPOTIFY_API_BASE_URL || "https://api.spotify.com/v1")
  };
}

export function getTidalApiConfig(): ProviderApiConfig & {
  searchUrlTemplate: string;
  countryCode: string;
} {
  const apiBaseUrl = normalizeBaseUrl(process.env.TIDAL_API_BASE_URL || "https://openapi.tidal.com/v2");

  return {
    apiBaseUrl,
    searchUrlTemplate: process.env.TIDAL_SEARCH_URL_TEMPLATE || `${apiBaseUrl}/searchresults/{query}`,
    countryCode: (process.env.TIDAL_COUNTRY_CODE || "US").trim().toUpperCase()
  };
}
