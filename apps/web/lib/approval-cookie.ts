import { createSignedPayload, readSignedPayload } from "@/lib/signed-payload";

const COOKIE_NAME = "approved_email";
const COOKIE_TTL_SECONDS = 60 * 60 * 24;

export function getApprovalCookieName(): string {
  return COOKIE_NAME;
}

export function getApprovalCookieMaxAge(): number {
  return COOKIE_TTL_SECONDS;
}

export function createApprovalCookieValue(email: string, secret: string): string {
  return createSignedPayload(email, secret);
}

export function readApprovalCookieValue(value: string, secret: string): string | null {
  return readSignedPayload(value, secret);
}
