import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "@/app/api/source/playlists/route";
import { createApprovalCookieValue, getApprovalCookieName } from "@/lib/approval-cookie";
import {
  createProviderSession,
  createProviderSessionCookieValue,
  getProviderSessionCookieName
} from "@/lib/provider-session";

function buildRequest(cookies: string[] = []): NextRequest {
  return new NextRequest("http://localhost/api/source/playlists?sourceProvider=spotify", {
    method: "GET",
    headers: cookies.length ? { cookie: cookies.join("; ") } : undefined
  });
}

describe("GET /api/source/playlists", () => {
  beforeEach(() => {
    process.env.APPROVED_EMAILS = "friend@example.com";
    process.env.APPROVAL_COOKIE_SECRET = "approval-secret";
    process.env.OAUTH_SESSION_SECRET = "oauth-session-secret";
    process.env.SPOTIFY_API_BASE_URL = "https://api.spotify.test/v1";
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("blocks unapproved requests", async () => {
    const response = await GET(buildRequest());
    expect(response.status).toBe(403);
  });

  it("requires a source provider session", async () => {
    const approvalCookie = createApprovalCookieValue("friend@example.com", process.env.APPROVAL_COOKIE_SECRET!);
    const response = await GET(buildRequest([`${getApprovalCookieName()}=${approvalCookie}`]));
    expect(response.status).toBe(401);
  });

  it("returns playlists for approved requests with a spotify session", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          items: [{ id: "pl-1", name: "Roadtrip", tracks: { total: 42 } }],
          next: null
        }),
        { status: 200, headers: { "content-type": "application/json" } }
      )
    );

    const approvalCookie = createApprovalCookieValue("friend@example.com", process.env.APPROVAL_COOKIE_SECRET!);
    const sessionCookie = createProviderSessionCookieValue(
      createProviderSession(
        "spotify",
        {
          accessToken: "spotify-access",
          tokenType: "Bearer",
          expiresIn: 3600
        },
        Date.now()
      ),
      process.env.OAUTH_SESSION_SECRET!
    );

    const response = await GET(
      buildRequest([
        `${getApprovalCookieName()}=${approvalCookie}`,
        `${getProviderSessionCookieName("spotify")}=${sessionCookie}`
      ])
    );

    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.sourceProvider).toBe("spotify");
    expect(payload.playlists).toEqual([{ id: "pl-1", name: "Roadtrip", trackCount: 42 }]);
  });
});
