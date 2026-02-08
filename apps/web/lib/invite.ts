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

function constantTimeEquals(left: string, right: string): boolean {
  const leftDigest = createHash("sha256").update(left).digest();
  const rightDigest = createHash("sha256").update(right).digest();

  return timingSafeEqual(leftDigest, rightDigest);
}

export function isApprovedEmail(email: string, allowlist: string[]): boolean {
  const normalizedEmail = normalizeEmail(email);
  return allowlist.some((approvedEmail) => constantTimeEquals(normalizedEmail, approvedEmail));
}
