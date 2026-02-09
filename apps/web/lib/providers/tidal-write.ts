import type { ProviderSession } from "@/lib/provider-session";
import { getTidalApiConfig } from "@/lib/env";

class TidalWriteError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "TidalWriteError";
    this.status = status;
  }
}

function getAuthHeader(session: ProviderSession): string {
  return `${session.tokenType || "Bearer"} ${session.accessToken}`;
}

export async function createTidalPlaylist(
  session: ProviderSession,
  name: string
): Promise<string> {
  const config = getTidalApiConfig();
  const url = `${config.apiBaseUrl}/playlists`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: getAuthHeader(session),
      "Content-Type": "application/vnd.api+json"
    },
    body: JSON.stringify({
      data: {
        type: "playlists",
        attributes: {
          title: name,
          description: `Transferred from Spotify via syncify`
        }
      }
    })
  });

  if (!response.ok) {
    throw new TidalWriteError(
      `Failed to create TIDAL playlist: ${response.status}`,
      response.status
    );
  }

  const payload = (await response.json()) as {
    data?: { id?: string };
    id?: string;
  };

  const playlistId = payload.data?.id || payload.id;
  if (!playlistId) {
    throw new TidalWriteError("TIDAL playlist creation returned no ID.", 502);
  }

  return String(playlistId);
}

export async function addTracksToTidalPlaylist(
  session: ProviderSession,
  playlistId: string,
  trackIds: string[]
): Promise<{ added: number; failed: number; failedIds: string[] }> {
  if (trackIds.length === 0) {
    return { added: 0, failed: 0, failedIds: [] };
  }

  const config = getTidalApiConfig();
  const url = `${config.apiBaseUrl}/playlists/${playlistId}/relationships/items`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: getAuthHeader(session),
      "Content-Type": "application/vnd.api+json"
    },
    body: JSON.stringify({
      data: trackIds.map((id) => ({
        id,
        type: "tracks"
      }))
    })
  });

  if (!response.ok) {
    if (response.status === 429) {
      throw new TidalWriteError("TIDAL rate limit exceeded.", 429);
    }
    throw new TidalWriteError(
      `Failed to add tracks to TIDAL playlist: ${response.status}`,
      response.status
    );
  }

  return { added: trackIds.length, failed: 0, failedIds: [] };
}

export async function addTrackToTidalFavorites(
  session: ProviderSession,
  trackId: string
): Promise<boolean> {
  const config = getTidalApiConfig();
  const url = `${config.apiBaseUrl}/favorites/tracks`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: getAuthHeader(session),
      "Content-Type": "application/vnd.api+json"
    },
    body: JSON.stringify({
      data: [{ id: trackId, type: "tracks" }]
    })
  });

  if (!response.ok) {
    if (response.status === 429) {
      throw new TidalWriteError("TIDAL rate limit exceeded.", 429);
    }
    if (response.status === 409) {
      // Track already in favorites — treat as success
      return true;
    }
    throw new TidalWriteError(
      `Failed to add track to TIDAL favorites: ${response.status}`,
      response.status
    );
  }

  return true;
}
