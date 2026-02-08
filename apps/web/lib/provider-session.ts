import type { OAuthProvider, OAuthTokenSet } from "@spotify-xyz/shared";
import { createSignedPayload, readSignedPayload } from "@/lib/signed-payload";

const MAX_SESSION_TTL_SECONDS = 60 * 60 * 24;

export interface ProviderSession {
  provider: OAuthProvider;
  accessToken: string;
  tokenType: string;
  scope?: string;
  refreshToken?: string;
  expiresAt: number;
  createdAt: number;
}

function encodeSession(session: ProviderSession): string {
  return Buffer.from(JSON.stringify(session)).toString("base64url");
}

function decodeSession(value: string): ProviderSession | null {
  try {
    const decoded = Buffer.from(value, "base64url").toString("utf8");
    const parsed = JSON.parse(decoded) as Partial<ProviderSession>;
    if (
      parsed &&
      (parsed.provider === "spotify" || parsed.provider === "tidal") &&
      typeof parsed.accessToken === "string" &&
      typeof parsed.tokenType === "string" &&
      typeof parsed.expiresAt === "number" &&
      typeof parsed.createdAt === "number"
    ) {
      return {
        provider: parsed.provider,
        accessToken: parsed.accessToken,
        tokenType: parsed.tokenType,
        scope: parsed.scope,
        refreshToken: parsed.refreshToken,
        expiresAt: parsed.expiresAt,
        createdAt: parsed.createdAt
      };
    }
    return null;
  } catch {
    return null;
  }
}

export function getProviderSessionCookieName(provider: OAuthProvider): string {
  return `oauth_session_${provider}`;
}

export function createProviderSession(
  provider: OAuthProvider,
  tokenSet: OAuthTokenSet,
  now = Date.now()
): ProviderSession {
  return {
    provider,
    accessToken: tokenSet.accessToken,
    tokenType: tokenSet.tokenType,
    scope: tokenSet.scope,
    refreshToken: tokenSet.refreshToken,
    expiresAt: now + tokenSet.expiresIn * 1000,
    createdAt: now
  };
}

export function getProviderSessionCookieMaxAge(session: ProviderSession): number {
  const ttlMs = Math.max(0, session.expiresAt - Date.now());
  return Math.max(1, Math.min(MAX_SESSION_TTL_SECONDS, Math.floor(ttlMs / 1000)));
}

export function createProviderSessionCookieValue(session: ProviderSession, secret: string): string {
  return createSignedPayload(encodeSession(session), secret);
}

export function readProviderSessionCookieValue(value: string, secret: string): ProviderSession | null {
  const payload = readSignedPayload(value, secret);
  if (!payload) {
    return null;
  }

  return decodeSession(payload);
}
