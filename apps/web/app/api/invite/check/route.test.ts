import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it } from "vitest";
import { POST } from "@/app/api/invite/check/route";
import { getApprovalCookieName } from "@/lib/approval-cookie";

function buildRequest(body: object): NextRequest {
  return new NextRequest("http://localhost/api/invite/check", {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify(body)
  });
}

describe("POST /api/invite/check", () => {
  beforeEach(() => {
    process.env.APPROVED_EMAILS = "friend@example.com";
    process.env.APPROVAL_COOKIE_SECRET = "test-secret";
  });

  it("matches approved email case-insensitively and sets cookie", async () => {
    const response = await POST(buildRequest({ email: "Friend@Example.com" }));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.approved).toBe(true);

    const cookie = response.cookies.get(getApprovalCookieName());
    expect(cookie?.value).toBeTruthy();
  });

  it("returns pending when email is not approved", async () => {
    const response = await POST(buildRequest({ email: "new@example.com" }));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.approved).toBe(false);
  });
});
