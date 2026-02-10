import { NextResponse, type NextRequest } from "next/server";
import { requireApprovedEmail, requireProviderSession } from "@/lib/auth-gate";
import { listSpotifyLikedTracks } from "@/lib/providers/spotify-catalog";
import { isOAuthProvider } from "@/lib/providers";

export async function GET(request: NextRequest): Promise<NextResponse> {
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

  const session = requireProviderSession(request, sourceProvider);
  if (!session.ok) {
    return session.response;
  }

  try {
    const result = await listSpotifyLikedTracks(session.session);
    return NextResponse.json({
      sourceProvider,
      tracks: result.tracks
    });
  } catch {
    return NextResponse.json({ error: "Failed to load source liked tracks." }, { status: 502 });
  }
}
