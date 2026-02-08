import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it } from "vitest";
import { POST } from "@/app/api/invite/request/route";
import { resetRateLimiter } from "@/lib/rate-limit";

function buildRequest(body: object, ip = "203.0.113.10"): NextRequest {
  return new NextRequest("http://localhost/api/invite/request", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-forwarded-for": ip
    },
    body: JSON.stringify(body)
  });
}

describe("POST /api/invite/request", () => {
  beforeEach(() => {
    resetRateLimiter();
    process.env.EMAIL_PROVIDER = "mock";
    process.env.INVITE_RATE_LIMIT_WINDOW = "3600";
    process.env.INVITE_RATE_LIMIT_MAX = "5";
    process.env.INVITE_BLOCKED_DOMAINS = "";
    process.env.INVITE_ADMIN_EMAIL = "owner@example.com";
  });

  it("accepts valid invite request", async () => {
    const response = await POST(buildRequest({ email: "friend@example.com" }));
    const payload = await response.json();

    expect(response.status).toBe(202);
    expect(payload.status).toBe("received");
    expect(typeof payload.requestId).toBe("string");
  });

  it("silently accepts honeypot submissions", async () => {
    const response = await POST(buildRequest({ email: "friend@example.com", honeypot: "botcorp" }));
    const payload = await response.json();

    expect(response.status).toBe(202);
    expect(payload.status).toBe("received");
  });

  it("returns safe 429 on rate limit", async () => {
    process.env.INVITE_RATE_LIMIT_MAX = "1";
    const first = await POST(buildRequest({ email: "friend@example.com" }));
    const second = await POST(buildRequest({ email: "friend@example.com" }));

    expect(first.status).toBe(202);
    expect(second.status).toBe(429);

    const payload = await second.json();
    expect(payload.error).toBe("Unable to process request right now.");
  });
});
