import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it } from "vitest";
import { GET } from "@/app/api/auth/[provider]/start/route";
import { createApprovalCookieValue, getApprovalCookieName } from "@/lib/approval-cookie";

function buildRequest(cookieValue?: string): NextRequest {
  return new NextRequest("http://localhost/api/auth/spotify/start", {
    method: "GET",
    headers: cookieValue
      ? {
          cookie: `${getApprovalCookieName()}=${cookieValue}`
        }
      : undefined
  });
}

describe("GET /api/auth/[provider]/start", () => {
  beforeEach(() => {
    process.env.APPROVED_EMAILS = "friend@example.com";
    process.env.APPROVAL_COOKIE_SECRET = "test-secret";
  });

  it("blocks unapproved requests", async () => {
    const response = await GET(buildRequest(), {
      params: Promise.resolve({ provider: "spotify" })
    });

    expect(response.status).toBe(403);
  });

  it("allows approved requests", async () => {
    const cookieValue = createApprovalCookieValue("friend@example.com", process.env.APPROVAL_COOKIE_SECRET!);

    const response = await GET(buildRequest(cookieValue), {
      params: Promise.resolve({ provider: "spotify" })
    });

    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.ok).toBe(true);
  });
});
