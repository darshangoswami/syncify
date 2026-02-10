import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { requireApprovedEmail, requireProviderSession } from "@/lib/auth-gate";
import {
  createTidalPlaylist,
  addTracksToTidalPlaylist,
  addTracksToTidalFavorites
} from "@/lib/providers/tidal-write";

const chunkRequestSchema = z.object({
  destinationProvider: z.literal("tidal"),
  playlistId: z.string().min(1),
  playlistName: z.string().min(1),
  destinationPlaylistId: z.string().optional(),
  trackIds: z.array(z.string().min(1)).min(1).max(20)
});

export async function POST(request: NextRequest): Promise<NextResponse> {
  const approval = requireApprovedEmail(request);
  if (!approval.ok) {
    return approval.response;
  }

  const tidalSession = requireProviderSession(request, "tidal");
  if (!tidalSession.ok) {
    return tidalSession.response;
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const parsed = chunkRequestSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid transfer chunk request." }, { status: 400 });
  }

  const { playlistId, playlistName, trackIds } = parsed.data;
  let destinationPlaylistId = parsed.data.destinationPlaylistId || "";
  let added = 0;
  let skipped = 0;
  let failed = 0;
  const failedTracks: Array<{ trackId: string; reason: string }> = [];

  if (playlistId === "liked") {
    // Add tracks to TIDAL favorites in batch
    try {
      const result = await addTracksToTidalFavorites(tidalSession.session, trackIds);
      added = result.added;
      failed = result.failed;
      for (const id of result.failedIds) {
        failedTracks.push({ trackId: id, reason: "Failed to add to favorites" });
      }
    } catch (err) {
      failed = trackIds.length;
      for (const trackId of trackIds) {
        failedTracks.push({
          trackId,
          reason: err instanceof Error ? err.message : "Unknown error"
        });
      }
    }
    destinationPlaylistId = "favorites";
  } else {
    // Create TIDAL playlist if needed
    if (!destinationPlaylistId) {
      try {
        destinationPlaylistId = await createTidalPlaylist(
          tidalSession.session,
          playlistName
        );
      } catch (err) {
        return NextResponse.json(
          {
            error: `Failed to create TIDAL playlist: ${err instanceof Error ? err.message : "Unknown error"}`
          },
          { status: 502 }
        );
      }
    }

    // Add tracks in batch
    try {
      const result = await addTracksToTidalPlaylist(
        tidalSession.session,
        destinationPlaylistId,
        trackIds
      );
      added = result.added;
      failed = result.failed;
      for (const id of result.failedIds) {
        failedTracks.push({ trackId: id, reason: "Failed to add to playlist" });
      }
    } catch (err) {
      // Entire batch failed — record all tracks as failed
      failed = trackIds.length;
      for (const trackId of trackIds) {
        failedTracks.push({
          trackId,
          reason: err instanceof Error ? err.message : "Unknown error"
        });
      }
    }
  }

  return NextResponse.json({
    ok: true,
    result: {
      added,
      skipped,
      failed,
      failedTracks,
      destinationPlaylistId
    }
  });
}
