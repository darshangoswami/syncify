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
