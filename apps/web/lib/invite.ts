import { createHash, timingSafeEqual } from "node:crypto";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeEmail(input: string): string {
  return input.trim().toLowerCase();
}

export function isValidEmail(email: string): boolean {
  if (email.length < 6 || email.length > 254) {
    return false;
  }

  return EMAIL_PATTERN.test(email);
}

export function isBlockedDomain(email: string, blockedDomains: string[]): boolean {
  const domain = email.split("@")[1];
  if (!domain) {
    return true;
  }

  return blockedDomains.includes(domain.toLowerCase());
}

export function isApprovedEmail(email: string, allowlist: string[]): boolean {
  const normalizedEmail = normalizeEmail(email);
  const leftDigest = createHash("sha256").update(normalizedEmail).digest();
  let found = false;
  for (const approved of allowlist) {
    const rightDigest = createHash("sha256").update(approved).digest();
    if (timingSafeEqual(leftDigest, rightDigest)) found = true;
  }
  return found;
}
