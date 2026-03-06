import type { ProviderSession } from "@/lib/provider-session";
import { getTidalApiConfig } from "@/lib/env";
import { ProviderApiError } from "@/lib/providers/errors";
import { getAuthHeader, tidalFetchWithRetry } from "@/lib/providers/shared";

class TidalWriteError extends ProviderApiError {
  constructor(message: string, status: number) {
    super(message, status, "TidalWriteError");
  }
}

const RETRY_OPTIONS = { throttleMs: 500, maxRetries: 4, retryBaseMs: 2000 };

function postWithRetry(
  url: string,
  session: ProviderSession,
  body: unknown
): Promise<Response> {
  return tidalFetchWithRetry(url, session, RETRY_OPTIONS, {
    method: "POST",
    headers: { "Content-Type": "application/vnd.api+json" },
    body: JSON.stringify(body)
  });
}

export async function getTidalUserId(session: ProviderSession): Promise<string> {
  const config = getTidalApiConfig();
  const response = await fetch(`${config.apiBaseUrl}/users/me`, {
    headers: { Authorization: getAuthHeader(session) }
  });

  if (!response.ok) {
    throw new TidalWriteError(
      `Failed to get TIDAL user: ${response.status}`,
      response.status
    );
  }

  const payload = (await response.json()) as {
    data?: { id?: string };
    id?: string;
  };

  const userId = payload.data?.id || payload.id;
  if (!userId) {
    throw new TidalWriteError("TIDAL user ID not found.", 502);
  }

  return String(userId);
}

export async function createTidalPlaylist(
  session: ProviderSession,
  name: string
): Promise<string> {
  const config = getTidalApiConfig();
  const url = `${config.apiBaseUrl}/playlists?countryCode=${config.countryCode}`;

  const response = await postWithRetry(url, session, {
    data: {
      type: "playlists",
      attributes: {
        name,
        description: "Transferred from Spotify via syncify"
      }
    }
  });

  if (!response.ok) {
    let body = "";
    try { body = await response.text(); } catch { /* ignore */ }
    throw new TidalWriteError(
      `Failed to create TIDAL playlist: ${response.status} ${body}`,
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

  const response = await postWithRetry(url, session, {
    data: trackIds.map((id) => ({ id, type: "tracks" }))
  });

  if (!response.ok) {
    let body = "";
    try { body = await response.text(); } catch { /* ignore */ }
    throw new TidalWriteError(
      `Failed to add tracks to TIDAL playlist: ${response.status} ${body}`,
      response.status
    );
  }

  return { added: trackIds.length, failed: 0, failedIds: [] };
}

export async function addTracksToTidalFavorites(
  session: ProviderSession,
  trackIds: string[]
): Promise<{ added: number; failed: number; failedIds: string[] }> {
  if (trackIds.length === 0) {
    return { added: 0, failed: 0, failedIds: [] };
  }

  const config = getTidalApiConfig();
  const userId = await getTidalUserId(session);
  const url = `${config.apiBaseUrl}/userCollections/${userId}/relationships/tracks`;

  const response = await postWithRetry(url, session, {
    data: trackIds.map((id) => ({ id, type: "tracks" }))
  });

  if (!response.ok) {
    if (response.status === 409) {
      return { added: trackIds.length, failed: 0, failedIds: [] };
    }
    let body = "";
    try { body = await response.text(); } catch { /* ignore */ }
    throw new TidalWriteError(
      `Failed to add tracks to TIDAL favorites: ${response.status} ${body}`,
      response.status
    );
  }

  return { added: trackIds.length, failed: 0, failedIds: [] };
}
