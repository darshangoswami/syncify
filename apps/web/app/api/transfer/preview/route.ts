import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import type { SourceTrack, TransferPreviewRequest, TransferPreviewResult } from "@spotify-xyz/shared";
import { requireApprovedEmail, requireProviderSession } from "@/lib/auth-gate";
import {
  listSpotifyLikedTracks,
  listSpotifyPlaylistTracks
} from "@/lib/providers/spotify-catalog";
import { searchTidalTracks } from "@/lib/providers/tidal-catalog";
import {
  buildDestinationSearchQuery,
  matchTrackAgainstCandidates
} from "@/lib/transfer-matcher";

const PREVIEW_MAX_TRACKS = 200;

const previewRequestSchema = z.object({
  sourceProvider: z.enum(["spotify", "tidal"]),
  destinationProvider: z.enum(["spotify", "tidal"]),
  playlistIds: z.array(z.string().min(1)).optional(),
  includeLiked: z.boolean().optional()
});

function dedupeTracks(tracks: SourceTrack[]): SourceTrack[] {
  const byKey = new Map<string, SourceTrack>();

  for (const track of tracks) {
    const key = track.isrc?.trim().toUpperCase() || `${track.id}:${track.playlistId || "liked"}`;
    if (!byKey.has(key)) {
      byKey.set(key, track);
    }
  }

  return [...byKey.values()];
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const approval = requireApprovedEmail(request);
  if (!approval.ok) {
    return approval.response;
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const parsed = previewRequestSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid transfer preview request." }, { status: 400 });
  }

  const input: TransferPreviewRequest = {
    sourceProvider: parsed.data.sourceProvider,
    destinationProvider: parsed.data.destinationProvider,
    playlistIds: parsed.data.playlistIds || [],
    includeLiked: parsed.data.includeLiked ?? true
  };

  if (input.sourceProvider !== "spotify" || input.destinationProvider !== "tidal") {
    return NextResponse.json(
      { error: "This preview release supports Spotify source and TIDAL destination only." },
      { status: 400 }
    );
  }

  const sourceSession = requireProviderSession(request, input.sourceProvider);
  if (!sourceSession.ok) {
    return sourceSession.response;
  }

  const destinationSession = requireProviderSession(request, input.destinationProvider);
  if (!destinationSession.ok) {
    return destinationSession.response;
  }

  if (!input.playlistIds?.length && !input.includeLiked) {
    return NextResponse.json({ error: "No source inputs selected for preview." }, { status: 400 });
  }

  const sourceTracks: SourceTrack[] = [];
  try {
    for (const playlistId of input.playlistIds || []) {
      const playlistTracks = await listSpotifyPlaylistTracks(sourceSession.session, playlistId);
      sourceTracks.push(...playlistTracks);
    }

    if (input.includeLiked) {
      const likedTracks = await listSpotifyLikedTracks(sourceSession.session);
      sourceTracks.push(...likedTracks);
    }
  } catch {
    return NextResponse.json({ error: "Failed to load source tracks for preview." }, { status: 502 });
  }

  const uniqueTracks = dedupeTracks(sourceTracks);
  const tracksForPreview = uniqueTracks.slice(0, PREVIEW_MAX_TRACKS);

  let matched = 0;
  const unmatchedTracks: TransferPreviewResult["unmatchedTracks"] = [];
  for (const sourceTrack of tracksForPreview) {
    try {
      const query = buildDestinationSearchQuery(sourceTrack);
      const candidates = await searchTidalTracks(destinationSession.session, query);
      const matchedTrack = matchTrackAgainstCandidates(sourceTrack, candidates);

      if (matchedTrack) {
        matched += 1;
      } else {
        unmatchedTracks.push({
          trackId: sourceTrack.id,
          title: sourceTrack.title,
          artist: sourceTrack.artist,
          reason: "no_destination_match"
        });
      }
    } catch {
      unmatchedTracks.push({
        trackId: sourceTrack.id,
        title: sourceTrack.title,
        artist: sourceTrack.artist,
        reason: "destination_lookup_failed"
      });
    }
  }

  const preview: TransferPreviewResult = {
    matched,
    unmatched: unmatchedTracks.length,
    totalSourceTracks: tracksForPreview.length,
    unmatchedTracks
  };

  return NextResponse.json({
    ok: true,
    preview
  });
}
