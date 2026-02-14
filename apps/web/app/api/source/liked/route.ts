import { NextResponse, type NextRequest } from "next/server";
import { requireApprovedEmail, requireProviderSession } from "@/lib/auth-gate";
import { logApiEvent, logApiError } from "@/lib/logging";
import { applyRefreshedSessionCookie } from "@/lib/provider-session";
import { listSpotifyLikedTracks } from "@/lib/providers/spotify-catalog";
import { isOAuthProvider } from "@/lib/providers";
import { getRequestId } from "@/lib/request";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const requestId = getRequestId(request);
  const startedAt = Date.now();

  const approval = requireApprovedEmail(request);
  if (!approval.ok) {
    return approval.response;
  }

  const sourceProvider = request.nextUrl.searchParams.get("sourceProvider") || "spotify";
  if (!isOAuthProvider(sourceProvider)) {
    return NextResponse.json({ error: "Unsupported source provider." }, { status: 400 });
  }

  if (sourceProvider !== "spotify") {
    return NextResponse.json({ error: "Liked tracks are only available for Spotify in this release." }, { status: 400 });
  }

  const session = await requireProviderSession(request, sourceProvider);
  if (!session.ok) {
    return session.response;
  }

  try {
    const result = await listSpotifyLikedTracks(session.session);
    logApiEvent({
      requestId, method: "GET", path: "/api/source/liked", status: 200,
      durationMs: Date.now() - startedAt, kind: "source_liked",
      detail: `count=${result.tracks.length}`
    });
    const response = NextResponse.json({
      sourceProvider,
      tracks: result.tracks
    });
    applyRefreshedSessionCookie(response, session);
    return response;
  } catch (err) {
    logApiError({ requestId, method: "GET", path: "/api/source/liked", kind: "source_liked", error: err instanceof Error ? err.message : "Failed to load liked tracks" });
    return NextResponse.json({ error: "Failed to load source liked tracks." }, { status: 502 });
  }
}
