import { createHmac, timingSafeEqual } from "node:crypto";

const COOKIE_NAME = "approved_email";
const COOKIE_TTL_SECONDS = 60 * 60 * 24;

function sign(email: string, secret: string): string {
  return createHmac("sha256", secret).update(email).digest("base64url");
}

export function getApprovalCookieName(): string {
  return COOKIE_NAME;
}

export function getApprovalCookieMaxAge(): number {
  return COOKIE_TTL_SECONDS;
}

export function createApprovalCookieValue(email: string, secret: string): string {
  const signature = sign(email, secret);
  return `${email}.${signature}`;
}

export function readApprovalCookieValue(value: string, secret: string): string | null {
  const index = value.lastIndexOf(".");
  if (index < 1) {
    return null;
  }

  const email = value.slice(0, index);
  const signature = value.slice(index + 1);
  const expected = sign(email, secret);
  const providedBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);

  if (providedBuffer.length !== expectedBuffer.length) {
    return null;
  }

  if (!timingSafeEqual(providedBuffer, expectedBuffer)) {
    return null;
  }

  return email;
}
