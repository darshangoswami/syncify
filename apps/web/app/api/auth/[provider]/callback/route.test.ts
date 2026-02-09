import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "@/app/api/auth/[provider]/callback/route";
import { createApprovalCookieValue, getApprovalCookieName } from "@/lib/approval-cookie";
import { createOAuthStateCookieValue, getOAuthStateCookieName } from "@/lib/oauth-state";
import {
  getProviderSessionCookieName,
  readProviderSessionCookieValue
} from "@/lib/provider-session";

function buildRequest(url: string, cookies: string[] = []): NextRequest {
  return new NextRequest(url, {
    method: "GET",
    headers: cookies.length ? { cookie: cookies.join("; ") } : undefined
  });
}

describe("GET /api/auth/[provider]/callback", () => {
  beforeEach(() => {
    process.env.APPROVED_EMAILS = "friend@example.com";
    process.env.APPROVAL_COOKIE_SECRET = "approval-secret";
    process.env.OAUTH_STATE_SECRET = "oauth-state-secret";
    process.env.OAUTH_SESSION_SECRET = "oauth-session-secret";
    process.env.SPOTIFY_CLIENT_ID = "spotify-client-id";
    process.env.SPOTIFY_CLIENT_SECRET = "spotify-client-secret";
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("blocks unapproved requests", async () => {
    const response = await GET(buildRequest("http://localhost/api/auth/spotify/callback"), {
      params: Promise.resolve({ provider: "spotify" })
    });

    expect(response.status).toBe(403);
  });

  it("rejects callbacks when state cookie is missing", async () => {
    const approvalCookie = createApprovalCookieValue("friend@example.com", process.env.APPROVAL_COOKIE_SECRET!);
    const request = buildRequest("http://localhost/api/auth/spotify/callback?code=abc&state=state123", [
      `${getApprovalCookieName()}=${approvalCookie}`
    ]);

    const response = await GET(request, {
      params: Promise.resolve({ provider: "spotify" })
    });

    expect(response.status).toBe(400);
  });

  it("exchanges code and stores provider session on success", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          access_token: "access-token",
          token_type: "Bearer",
          expires_in: 3600,
          refresh_token: "refresh-token",
          scope: "playlist-read-private"
        }),
        {
          status: 200,
          headers: {
            "content-type": "application/json"
          }
        }
      )
    );

    const state = "state123";
    const approvalCookie = createApprovalCookieValue("friend@example.com", process.env.APPROVAL_COOKIE_SECRET!);
    const stateCookie = createOAuthStateCookieValue(
      "spotify",
      "friend@example.com",
      state,
      process.env.OAUTH_STATE_SECRET!
    );
    const request = buildRequest(`http://localhost/api/auth/spotify/callback?code=abc&state=${state}`, [
      `${getApprovalCookieName()}=${approvalCookie}`,
      `${getOAuthStateCookieName("spotify")}=${stateCookie}`
    ]);

    const response = await GET(request, {
      params: Promise.resolve({ provider: "spotify" })
    });

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("http://localhost/connections");

    const sessionCookie = response.cookies.get(getProviderSessionCookieName("spotify"));
    expect(sessionCookie?.value).toBeTruthy();

    const session = readProviderSessionCookieValue(sessionCookie!.value, process.env.OAUTH_SESSION_SECRET!);
    expect(session?.provider).toBe("spotify");
    expect(session?.accessToken).toBe("access-token");
  });

  it("returns 502 when token exchange fails", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          error: "invalid_grant",
          error_description: "Code expired"
        }),
        {
          status: 400,
          headers: {
            "content-type": "application/json"
          }
        }
      )
    );

    const state = "state123";
    const approvalCookie = createApprovalCookieValue("friend@example.com", process.env.APPROVAL_COOKIE_SECRET!);
    const stateCookie = createOAuthStateCookieValue(
      "spotify",
      "friend@example.com",
      state,
      process.env.OAUTH_STATE_SECRET!
    );
    const request = buildRequest(`http://localhost/api/auth/spotify/callback?code=abc&state=${state}`, [
      `${getApprovalCookieName()}=${approvalCookie}`,
      `${getOAuthStateCookieName("spotify")}=${stateCookie}`
    ]);

    const response = await GET(request, {
      params: Promise.resolve({ provider: "spotify" })
    });

    expect(response.status).toBe(502);
  });

  it("rejects tidal callback when pkce verifier is missing from state", async () => {
    const state = "state123";
    const approvalCookie = createApprovalCookieValue("friend@example.com", process.env.APPROVAL_COOKIE_SECRET!);
    const stateCookie = createOAuthStateCookieValue(
      "tidal",
      "friend@example.com",
      state,
      process.env.OAUTH_STATE_SECRET!
    );
    const request = buildRequest(`http://localhost/api/auth/tidal/callback?code=abc&state=${state}`, [
      `${getApprovalCookieName()}=${approvalCookie}`,
      `${getOAuthStateCookieName("tidal")}=${stateCookie}`
    ]);

    const response = await GET(request, {
      params: Promise.resolve({ provider: "tidal" })
    });

    expect(response.status).toBe(400);
  });
});
