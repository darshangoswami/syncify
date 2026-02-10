import { NextResponse, type NextRequest } from "next/server";
import { requireApprovedEmail, requireProviderSession } from "@/lib/auth-gate";
import { logApiEvent, logApiError } from "@/lib/logging";
import { listSpotifyPlaylists } from "@/lib/providers/spotify-catalog";
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
    return NextResponse.json({ error: "Source playlists are only available for Spotify in this release." }, { status: 400 });
  }

  const session = requireProviderSession(request, sourceProvider);
  if (!session.ok) {
    return session.response;
  }

  try {
    const playlists = await listSpotifyPlaylists(session.session);
    logApiEvent({
      requestId, method: "GET", path: "/api/source/playlists", status: 200,
      durationMs: Date.now() - startedAt, kind: "source_playlists",
      detail: `count=${playlists.length}`
    });
    return NextResponse.json({
      sourceProvider,
      playlists
    });
  } catch (err) {
    logApiError({ requestId, method: "GET", path: "/api/source/playlists", kind: "source_playlists", error: err instanceof Error ? err.message : "Failed to load playlists" });
    return NextResponse.json({ error: "Failed to load source playlists." }, { status: 502 });
  }
}
