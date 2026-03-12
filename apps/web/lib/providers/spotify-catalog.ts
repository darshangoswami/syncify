import type { SourcePlaylist, SourceTrack } from "@syncify/shared";
import type { ProviderSession } from "@/lib/provider-session";
import { getSpotifyApiConfig } from "@/lib/env";
import { ProviderApiError } from "@/lib/providers/errors";
import { getAuthHeader, getString, getNumber } from "@/lib/providers/shared";

class SpotifyApiError extends ProviderApiError {
  constructor(message: string, status: number) {
    super(message, status, "SpotifyApiError");
  }
}

function getPrimaryArtist(value: unknown): string {
  if (!Array.isArray(value)) {
    return "Unknown artist";
  }

  const first = value[0];
  if (!first || typeof first !== "object") {
    return "Unknown artist";
  }

  const artistName = getString((first as { name?: unknown }).name);
  return artistName || "Unknown artist";
}

function mapSpotifyTrack(value: unknown, playlistId?: string): SourceTrack | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const track = value as {
    id?: unknown;
    name?: unknown;
    artists?: unknown;
    duration_ms?: unknown;
    external_ids?: { isrc?: unknown };
  };

  const id = getString(track.id);
  const title = getString(track.name);
  if (!id || !title) {
    return null;
  }

  const durationMs = getNumber(track.duration_ms);
  const isrc = getString(track.external_ids?.isrc)?.toUpperCase();

  return {
    id,
    title,
    artist: getPrimaryArtist(track.artists),
    isrc: isrc || undefined,
    durationMs: durationMs || undefined,
    playlistId
  };
}

async function spotifyGet(session: ProviderSession, pathOrUrl: string): Promise<unknown> {
  const { apiBaseUrl } = getSpotifyApiConfig();
  const url = pathOrUrl.startsWith("http") ? pathOrUrl : `${apiBaseUrl}${pathOrUrl}`;

  const response = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: getAuthHeader(session)
    }
  });

  let payload: unknown = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) {
    throw new SpotifyApiError("Spotify API request failed.", response.status);
  }

  return payload;
}

export async function listSpotifyPlaylists(session: ProviderSession): Promise<SourcePlaylist[]> {
  const playlists: SourcePlaylist[] = [];
  let nextUrl: string | null = "/me/playlists?limit=50";

  while (nextUrl) {
    const payload = await spotifyGet(session, nextUrl);
    const root = payload as { items?: unknown; next?: unknown };
    const items = Array.isArray(root.items) ? root.items : [];

    for (const item of items) {
      if (!item || typeof item !== "object") {
        continue;
      }

      const playlist = item as { id?: unknown; name?: unknown; tracks?: { total?: unknown } };
      const id = getString(playlist.id);
      const name = getString(playlist.name);
      const trackCount = getNumber(playlist.tracks?.total);
      if (!id || !name) {
        continue;
      }

      playlists.push({
        id,
        name,
        trackCount: trackCount && trackCount >= 0 ? Math.floor(trackCount) : 0
      });
    }

    nextUrl = getString(root.next);
  }

  return playlists;
}

export interface SpotifyTrackListResult {
  tracks: SourceTrack[];
  totalItemsSeen: number;
}

export async function listSpotifyLikedTracks(session: ProviderSession): Promise<SpotifyTrackListResult> {
  const tracks: SourceTrack[] = [];
  let totalItemsSeen = 0;
  let nextUrl: string | null = "/me/tracks?limit=50";

  while (nextUrl) {
    const payload = await spotifyGet(session, nextUrl);
    const root = payload as { items?: unknown; next?: unknown };
    const items = Array.isArray(root.items) ? root.items : [];
    totalItemsSeen += items.length;

    for (const item of items) {
      if (!item || typeof item !== "object") {
        continue;
      }

      const mapped = mapSpotifyTrack((item as { track?: unknown }).track);
      if (mapped) {
        tracks.push(mapped);
      }
    }

    nextUrl = getString(root.next);
  }

  return { tracks, totalItemsSeen };
}

export async function listSpotifyPlaylistTracks(
  session: ProviderSession,
  playlistId: string
): Promise<SpotifyTrackListResult> {
  const tracks: SourceTrack[] = [];
  let totalItemsSeen = 0;
  let nextUrl: string | null = `/playlists/${encodeURIComponent(playlistId)}/tracks?limit=100`;

  while (nextUrl) {
    const payload = await spotifyGet(session, nextUrl);
    const root = payload as { items?: unknown; next?: unknown };
    const items = Array.isArray(root.items) ? root.items : [];
    totalItemsSeen += items.length;

    for (const item of items) {
      if (!item || typeof item !== "object") {
        continue;
      }

      const mapped = mapSpotifyTrack((item as { track?: unknown }).track, playlistId);
      if (mapped) {
        tracks.push(mapped);
      }
    }

    nextUrl = getString(root.next);
  }

  return { tracks, totalItemsSeen };
}
