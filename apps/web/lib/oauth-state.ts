import { randomBytes, timingSafeEqual } from "node:crypto";
import type { OAuthProvider } from "@spotify-xyz/shared";
import { createSignedPayload, readSignedPayload } from "@/lib/signed-payload";

const OAUTH_STATE_COOKIE_TTL_SECONDS = 60 * 10;

interface OAuthStatePayload {
  provider: OAuthProvider;
  approvedEmail: string;
  state: string;
  codeVerifier?: string;
  createdAt: number;
}

function encodePayload(payload: OAuthStatePayload): string {
  return Buffer.from(JSON.stringify(payload)).toString("base64url");
}

function decodePayload(value: string): OAuthStatePayload | null {
  try {
    const decoded = Buffer.from(value, "base64url").toString("utf8");
    const parsed = JSON.parse(decoded) as Partial<OAuthStatePayload>;
    if (
      parsed &&
      (parsed.provider === "spotify" || parsed.provider === "tidal") &&
      typeof parsed.approvedEmail === "string" &&
      typeof parsed.state === "string" &&
      (typeof parsed.codeVerifier === "undefined" || typeof parsed.codeVerifier === "string") &&
      typeof parsed.createdAt === "number"
    ) {
      return {
        provider: parsed.provider,
        approvedEmail: parsed.approvedEmail,
        state: parsed.state,
        codeVerifier: parsed.codeVerifier,
        createdAt: parsed.createdAt
      };
    }
    return null;
  } catch {
    return null;
  }
}

export function getOAuthStateCookieName(provider: OAuthProvider): string {
  return `oauth_state_${provider}`;
}

export function getOAuthStateCookieMaxAge(): number {
  return OAUTH_STATE_COOKIE_TTL_SECONDS;
}

export function createOAuthState(): string {
  return randomBytes(24).toString("base64url");
}

export function createOAuthStateCookieValue(
  provider: OAuthProvider,
  approvedEmail: string,
  state: string,
  secret: string,
  codeVerifier?: string
): string {
  const payload = encodePayload({
    provider,
    approvedEmail,
    state,
    codeVerifier,
    createdAt: Date.now()
  });

  return createSignedPayload(payload, secret);
}

export function readOAuthStateCookieValue(value: string, secret: string): OAuthStatePayload | null {
  const payload = readSignedPayload(value, secret);
  if (!payload) {
    return null;
  }

  return decodePayload(payload);
}

export function isMatchingOAuthState(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return timingSafeEqual(leftBuffer, rightBuffer);
}
