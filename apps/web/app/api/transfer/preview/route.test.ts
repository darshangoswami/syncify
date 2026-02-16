import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/transfer/preview/route";
import { createApprovalCookieValue, getApprovalCookieName } from "@/lib/approval-cookie";
import {
  createProviderSession,
  createProviderSessionCookieValue,
  getProviderSessionCookieName
} from "@/lib/provider-session";

function buildProviderCookie(provider: "spotify" | "tidal", secret: string): string {
  const value = createProviderSessionCookieValue(
    createProviderSession(
      provider,
      {
        accessToken: `${provider}-access-token`,
        tokenType: "Bearer",
        expiresIn: 3600
      },
      Date.now()
    ),
    secret
  );

  return `${getProviderSessionCookieName(provider)}=${value}`;
}

function buildRequest(body: unknown, cookies: string[] = []): NextRequest {
  return new NextRequest("http://localhost/api/transfer/preview", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(cookies.length ? { cookie: cookies.join("; ") } : {})
    },
    body: JSON.stringify(body)
  });
}

describe("POST /api/transfer/preview", () => {
  beforeEach(() => {
    process.env.APPROVED_EMAILS = "friend@example.com";
    process.env.APPROVAL_COOKIE_SECRET = "approval-secret";
    process.env.OAUTH_SESSION_SECRET = "oauth-session-secret";
    process.env.SPOTIFY_API_BASE_URL = "https://api.spotify.test/v1";
    process.env.TIDAL_SEARCH_URL_TEMPLATE = "https://api.tidal.test/searchresults/{query}";
    process.env.TIDAL_COUNTRY_CODE = "US";
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("blocks unapproved requests", async () => {
    const response = await POST(
      buildRequest({
        sourceProvider: "spotify",
        destinationProvider: "tidal",
        playlistIds: ["pl-1"],
        includeLiked: false
      })
    );

    expect(response.status).toBe(403);
  });

  it("requires source and destination sessions", async () => {
    const approvalCookie = createApprovalCookieValue("friend@example.com", process.env.APPROVAL_COOKIE_SECRET!);
    const response = await POST(
      buildRequest(
        {
          sourceProvider: "spotify",
          destinationProvider: "tidal",
          playlistIds: ["pl-1"],
          includeLiked: false
        },
        [`${getApprovalCookieName()}=${approvalCookie}`]
      )
    );

    expect(response.status).toBe(401);
  });

  it("returns 400 for invalid preview payloads", async () => {
    const approvalCookie = createApprovalCookieValue("friend@example.com", process.env.APPROVAL_COOKIE_SECRET!);
    const response = await POST(
      buildRequest(
        {
          sourceProvider: "spotify"
        },
        [`${getApprovalCookieName()}=${approvalCookie}`]
      )
    );

    expect(response.status).toBe(400);
  });

  it("returns matched and unmatched counts using isrc + strict metadata fallback", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            items: [
              {
                track: {
                  id: "src-1",
                  name: "Blue Hour",
                  duration_ms: 180000,
                  external_ids: { isrc: "USAAA1111111" },
                  artists: [{ name: "Wave" }]
                }
              },
              {
                track: {
                  id: "src-2",
                  name: "City Lights (Edit)",
                  duration_ms: 200000,
                  artists: [{ name: "Nova feat. Arc" }]
                }
              },
              {
                track: {
                  id: "src-3",
                  name: "No Match Song",
                  duration_ms: 220000,
                  artists: [{ name: "Ghost" }]
                }
              }
            ],
            next: null
          }),
          { status: 200, headers: { "content-type": "application/json" } }
        )
      )
      // ISRC batch lookup: returns tidal-1 matched by ISRC
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            data: [{ id: "tidal-1", type: "tracks", attributes: { title: "Any Name", isrc: "USAAA1111111" } }]
          }),
          { status: 200, headers: { "content-type": "application/json" } }
        )
      )
      // Search fallback for src-2 (no ISRC): metadata match
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            included: [{ id: "tidal-2", type: "tracks", attributes: { title: "City Lights (Edit)", isrc: "OTHER123", duration: "PT3M20S", artists: [{ name: "Nova feat. Arc" }] } }],
            data: [{ id: "tidal-2", type: "tracks" }]
          }),
          { status: 200, headers: { "content-type": "application/json" } }
        )
      )
      // Search fallback for src-3 (no ISRC): no match
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            included: [{ id: "tidal-3", type: "tracks", attributes: { title: "Different", isrc: "NOPE999", duration: "PT3M40S" } }],
            data: [{ id: "tidal-3", type: "tracks" }]
          }),
          { status: 200, headers: { "content-type": "application/json" } }
        )
      );

    const approvalCookie = createApprovalCookieValue("friend@example.com", process.env.APPROVAL_COOKIE_SECRET!);
    const response = await POST(
      buildRequest(
        {
          sourceProvider: "spotify",
          destinationProvider: "tidal",
          playlistIds: ["pl-1"],
          includeLiked: false
        },
        [
          `${getApprovalCookieName()}=${approvalCookie}`,
          buildProviderCookie("spotify", process.env.OAUTH_SESSION_SECRET!),
          buildProviderCookie("tidal", process.env.OAUTH_SESSION_SECRET!)
        ]
      )
    );

    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.preview.matched).toBe(2);
    expect(payload.preview.unmatched).toBe(1);
    expect(payload.preview.totalSourceTracks).toBe(3);
    expect(payload.preview.unmatchedTracks).toEqual([
      {
        playlistId: "pl-1",
        trackId: "src-3",
        title: "No Match Song",
        artist: "Ghost",
        reason: "no_destination_match"
      }
    ]);
    expect(payload.preview.playlists).toHaveLength(1);
    expect(payload.preview.playlists[0].playlistId).toBe("pl-1");
    expect(payload.preview.playlists[0].matchedCount).toBe(2);
    expect(payload.preview.playlists[0].unmatchedCount).toBe(1);
    expect(payload.preview.playlists[0].matchedTracks).toHaveLength(2);
  });
});
