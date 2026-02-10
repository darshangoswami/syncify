import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import type {
  SourceTrack,
  TransferMatchedTrack,
  TransferPreviewPlaylistBreakdown,
  TransferPreviewRequest,
  TransferPreviewResult,
  TransferPreviewResultV2
} from "@spotify-xyz/shared";
import { requireApprovedEmail, requireProviderSession } from "@/lib/auth-gate";
import {
  listSpotifyLikedTracks,
  listSpotifyPlaylistTracks
} from "@/lib/providers/spotify-catalog";
import { lookupTidalTracksByIsrc, searchTidalTracks } from "@/lib/providers/tidal-catalog";
import {
  buildDestinationSearchQuery,
  matchTrackAgainstCandidates
} from "@/lib/transfer-matcher";

const previewRequestSchema = z.object({
  sourceProvider: z.enum(["spotify", "tidal"]),
  destinationProvider: z.enum(["spotify", "tidal"]),
  playlistIds: z.array(z.string().min(1)).optional(),
  includeLiked: z.boolean().optional(),
  playlistNames: z.record(z.string()).optional()
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

interface MatchResult {
  matched: TransferMatchedTrack;
  playlistId: string;
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

  const input: TransferPreviewRequest & { playlistNames?: Record<string, string> } = {
    sourceProvider: parsed.data.sourceProvider,
    destinationProvider: parsed.data.destinationProvider,
    playlistIds: parsed.data.playlistIds || [],
    includeLiked: parsed.data.includeLiked ?? true,
    playlistNames: parsed.data.playlistNames
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

  // Collect source tracks grouped by playlist
  const tracksByPlaylist = new Map<string, SourceTrack[]>();

  try {
    for (const playlistId of input.playlistIds || []) {
      const playlistTracks = await listSpotifyPlaylistTracks(sourceSession.session, playlistId);
      const tagged = playlistTracks.map((t) => ({ ...t, playlistId }));
      tracksByPlaylist.set(playlistId, tagged);
    }

    if (input.includeLiked) {
      const likedTracks = await listSpotifyLikedTracks(sourceSession.session);
      const tagged = likedTracks.map((t) => ({ ...t, playlistId: "liked" }));
      tracksByPlaylist.set("liked", tagged);
    }
  } catch {
    return NextResponse.json({ error: "Failed to load source tracks for preview." }, { status: 502 });
  }

  // Flatten and dedupe for matching
  const allTracks: SourceTrack[] = [];
  for (const tracks of tracksByPlaylist.values()) {
    allTracks.push(...tracks);
  }
  const uniqueTracks = dedupeTracks(allTracks);

  // Phase 1: Batch ISRC lookup (fast — resolves most tracks in ~100 API calls)
  const isrcToSource = new Map<string, SourceTrack[]>();
  const tracksWithoutIsrc: SourceTrack[] = [];

  for (const track of uniqueTracks) {
    if (track.isrc) {
      const key = track.isrc.trim().toUpperCase();
      const list = isrcToSource.get(key) || [];
      list.push(track);
      isrcToSource.set(key, list);
    } else {
      tracksWithoutIsrc.push(track);
    }
  }

  let totalMatched = 0;
  const unmatchedTracks: TransferPreviewResult["unmatchedTracks"] = [];
  const matchResults: MatchResult[] = [];

  // Batch lookup all ISRCs
  const isrcResults = await lookupTidalTracksByIsrc(
    destinationSession.session,
    [...isrcToSource.keys()]
  );

  // Record ISRC matches
  const isrcMissed: SourceTrack[] = [];
  for (const [isrc, sourceTracks] of isrcToSource) {
    const tidalTrack = isrcResults.get(isrc);
    if (tidalTrack) {
      for (const sourceTrack of sourceTracks) {
        totalMatched += 1;
        matchResults.push({
          matched: {
            sourceTrackId: sourceTrack.id,
            destinationTrackId: tidalTrack.id,
            title: sourceTrack.title,
            artist: sourceTrack.artist
          },
          playlistId: sourceTrack.playlistId || "liked"
        });
      }
    } else {
      isrcMissed.push(...sourceTracks);
    }
  }

  // Phase 2: Search fallback for tracks without ISRC or ISRC not found on TIDAL
  const searchFallbacks = [...tracksWithoutIsrc, ...isrcMissed];
  for (const sourceTrack of searchFallbacks) {
    try {
      const query = buildDestinationSearchQuery(sourceTrack);
      const candidates = await searchTidalTracks(destinationSession.session, query);
      const matchedTrack = matchTrackAgainstCandidates(sourceTrack, candidates);

      if (matchedTrack) {
        totalMatched += 1;
        matchResults.push({
          matched: {
            sourceTrackId: sourceTrack.id,
            destinationTrackId: matchedTrack.id,
            title: sourceTrack.title,
            artist: sourceTrack.artist
          },
          playlistId: sourceTrack.playlistId || "liked"
        });
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

  // Build per-playlist breakdowns
  const playlistNames = input.playlistNames || {};
  const playlists: TransferPreviewPlaylistBreakdown[] = [];

  for (const [playlistId, tracks] of tracksByPlaylist) {
    const deduped = dedupeTracks(tracks);
    const playlistMatches = matchResults.filter((r) => r.playlistId === playlistId);
    const playlistUnmatched = deduped.length - playlistMatches.length;

    playlists.push({
      playlistId,
      playlistName: playlistId === "liked"
        ? "Liked Songs"
        : playlistNames[playlistId] || `Playlist ${playlistId}`,
      totalTracks: deduped.length,
      matchedCount: playlistMatches.length,
      unmatchedCount: playlistUnmatched,
      matchedTracks: playlistMatches.map((r) => r.matched)
    });
  }

  const preview: TransferPreviewResultV2 = {
    matched: totalMatched,
    unmatched: unmatchedTracks.length,
    totalSourceTracks: uniqueTracks.length,
    unmatchedTracks,
    playlists
  };

  return NextResponse.json({
    ok: true,
    preview
  });
}
