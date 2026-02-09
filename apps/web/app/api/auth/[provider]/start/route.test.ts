import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it } from "vitest";
import { GET } from "@/app/api/auth/[provider]/start/route";
import { createApprovalCookieValue, getApprovalCookieName } from "@/lib/approval-cookie";
import { getOAuthStateCookieName } from "@/lib/oauth-state";

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
    process.env.APP_BASE_URL = "http://localhost:3000";
    process.env.SPOTIFY_CLIENT_ID = "spotify-client-id";
    process.env.SPOTIFY_CLIENT_SECRET = "spotify-client-secret";
    process.env.TIDAL_CLIENT_ID = "tidal-client-id";
    process.env.TIDAL_CLIENT_SECRET = "tidal-client-secret";
    process.env.TIDAL_AUTHORIZATION_URL = "https://login.tidal.com/authorize";
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

    expect(response.status).toBe(307);
    const location = response.headers.get("location");
    expect(location).toContain("https://accounts.spotify.com/authorize");
    expect(location).toContain("client_id=spotify-client-id");

    const stateCookie = response.cookies.get(getOAuthStateCookieName("spotify"));
    expect(stateCookie?.value).toBeTruthy();
  });

  it("returns 404 for unsupported providers", async () => {
    const cookieValue = createApprovalCookieValue("friend@example.com", process.env.APPROVAL_COOKIE_SECRET!);

    const response = await GET(buildRequest(cookieValue), {
      params: Promise.resolve({ provider: "apple-music" })
    });

    expect(response.status).toBe(404);
  });

  it("builds tidal authorization url with pkce parameters", async () => {
    const cookieValue = createApprovalCookieValue("friend@example.com", process.env.APPROVAL_COOKIE_SECRET!);
    const response = await GET(buildRequest(cookieValue), {
      params: Promise.resolve({ provider: "tidal" })
    });

    expect(response.status).toBe(307);
    const location = response.headers.get("location");
    expect(location).toContain("https://login.tidal.com/authorize");
    expect(location).toContain("client_id=tidal-client-id");
    expect(location).toContain("code_challenge=");
    expect(location).toContain("code_challenge_method=S256");
  });
});
