import type { SourceTrack } from "@spotify-xyz/shared";
import type { ProviderSession } from "@/lib/provider-session";
import { getTidalApiConfig } from "@/lib/env";
import { getTidalUserId } from "@/lib/providers/tidal-write";
import { ProviderApiError } from "@/lib/providers/errors";
import { getString, getNumber, tidalFetchWithRetry } from "@/lib/providers/shared";

class TidalApiError extends ProviderApiError {
  constructor(message: string, status: number) {
    super(message, status, "TidalApiError");
  }
}

function parseIsoDuration(value: unknown): number {
  if (typeof value !== "string") return 0;
  const match = value.match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?$/);
  if (!match) return 0;
  const hours = parseInt(match[1] || "0", 10);
  const minutes = parseInt(match[2] || "0", 10);
  const seconds = parseFloat(match[3] || "0");
  return Math.floor((hours * 3600 + minutes * 60 + seconds) * 1000);
}

function ensureCountryParam(url: URL, countryCode: string): void {
  if (!url.searchParams.has("countryCode")) {
    url.searchParams.set("countryCode", countryCode);
  }
}

function buildSearchUrl(query: string): string {
  const config = getTidalApiConfig();
  const template = config.searchUrlTemplate;

  // If the template contains {query}, substitute it; otherwise use ?query= param
  if (template.includes("{query}")) {
    const withQuery = template.replace("{query}", encodeURIComponent(query));
    const url = new URL(withQuery);
    if (!url.searchParams.has("limit")) {
      url.searchParams.set("limit", "10");
    }
    if (!url.searchParams.has("include")) {
      url.searchParams.set("include", "tracks");
    }
    ensureCountryParam(url, config.countryCode);
    return url.toString();
  }

  // Default: use the template as base URL with query as a search param
  const url = template.startsWith("http")
    ? new URL(template)
    : new URL(template, `${config.apiBaseUrl}/`);
  url.searchParams.set("query", query);
  if (!url.searchParams.has("limit")) {
    url.searchParams.set("limit", "10");
  }
  url.searchParams.set("offset", "0");
  ensureCountryParam(url, config.countryCode);

  return url.toString();
}

function toSourceTrack(value: unknown): SourceTrack | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const record = value as {
    id?: unknown;
    title?: unknown;
    name?: unknown;
    isrc?: unknown;
    durationMs?: unknown;
    duration?: unknown;
    artists?: unknown;
    artist?: unknown;
  };

  const id = getString(record.id) || (record.id != null ? String(record.id) : null);
  const title = getString(record.title) || getString(record.name);
  if (!id || !title) {
    return null;
  }

  const artists = Array.isArray(record.artists)
    ? record.artists
    : record.artist
      ? [record.artist]
      : [];
  let artist = "Unknown artist";
  if (artists.length > 0) {
    const first = artists[0];
    if (typeof first === "string") {
      artist = first;
    } else if (first && typeof first === "object") {
      artist = getString((first as { name?: unknown }).name) || artist;
    }
  }

  const durationMs = getNumber(record.durationMs) || parseIsoDuration(record.duration) || (getNumber(record.duration) || 0) * 1000;
  const isrc = getString(record.isrc)?.toUpperCase();

  return {
    id,
    title,
    artist,
    isrc: isrc || undefined,
    durationMs: durationMs > 0 ? Math.floor(durationMs) : undefined
  };
}

function extractTrackArray(payload: unknown): unknown[] {
  if (!payload || typeof payload !== "object") {
    return [];
  }

  const root = payload as {
    tracks?: unknown;
    data?: unknown;
    items?: unknown;
    included?: unknown;
  };

  // JSON:API compound document: prefer "included" (full resources with attributes)
  if (Array.isArray(root.included) && root.included.length > 0) {
    return root.included;
  }

  if (Array.isArray(root.tracks)) {
    return root.tracks;
  }

  if (root.tracks && typeof root.tracks === "object") {
    const tracksObject = root.tracks as { items?: unknown; data?: unknown };
    if (Array.isArray(tracksObject.items)) {
      return tracksObject.items;
    }
    if (Array.isArray(tracksObject.data)) {
      return tracksObject.data;
    }
  }

  if (Array.isArray(root.items)) {
    return root.items;
  }

  if (Array.isArray(root.data)) {
    return root.data;
  }

  return [];
}

function normalizeTrackNode(value: unknown): unknown {
  if (!value || typeof value !== "object") {
    return value;
  }

  const node = value as {
    resource?: unknown;
    attributes?: unknown;
    item?: unknown;
  };

  if (node.resource && typeof node.resource === "object") {
    return node.resource;
  }

  if (node.attributes && typeof node.attributes === "object") {
    const attr = node.attributes as Record<string, unknown>;
    const outer = value as { id?: unknown; relationships?: unknown };
    let artists = attr.artists;
    if (!artists && outer.relationships && typeof outer.relationships === "object") {
      const rels = outer.relationships as { artists?: { data?: unknown[] } };
      if (Array.isArray(rels.artists?.data)) {
        artists = rels.artists.data.map((a: unknown) => {
          if (a && typeof a === "object") {
            const artist = a as { id?: string; meta?: { name?: string } };
            return { name: artist.meta?.name || artist.id || "Unknown" };
          }
          return { name: "Unknown" };
        });
      }
    }
    return {
      id: attr.id || outer.id,
      title: attr.title,
      isrc: attr.isrc,
      durationMs: attr.durationMs,
      duration: attr.duration,
      artists
    };
  }

  if (node.item && typeof node.item === "object") {
    return node.item;
  }

  return node;
}

const RETRY_OPTIONS = { throttleMs: 250, maxRetries: 4, retryBaseMs: 1000 };
const ISRC_BATCH_SIZE = 20;

async function fetchWithRetry(
  url: string,
  session: ProviderSession
): Promise<{ response: Response; payload: unknown }> {
  const response = await tidalFetchWithRetry(url, session, RETRY_OPTIONS, {
    method: "GET"
  });

  let payload: unknown = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) {
    throw new TidalApiError("TIDAL API request failed.", response.status);
  }

  return { response, payload };
}

/**
 * Batch-resolve TIDAL tracks by ISRC codes.
 * Returns a map of ISRC -> SourceTrack for all found tracks.
 */
export async function lookupTidalTracksByIsrc(
  session: ProviderSession,
  isrcs: string[]
): Promise<Map<string, SourceTrack>> {
  const result = new Map<string, SourceTrack>();
  if (isrcs.length === 0) return result;

  const config = getTidalApiConfig();

  for (let i = 0; i < isrcs.length; i += ISRC_BATCH_SIZE) {
    const batch = isrcs.slice(i, i + ISRC_BATCH_SIZE);
    const url = new URL(`${config.apiBaseUrl}/tracks`);
    for (const isrc of batch) {
      url.searchParams.append("filter[isrc]", isrc);
    }
    url.searchParams.set("countryCode", config.countryCode);

    try {
      const { payload } = await fetchWithRetry(url.toString(), session);
      // Extract from "data" directly (not "included" which would contain related resources)
      const root = payload as { data?: unknown[] } | null;
      const nodes = Array.isArray(root?.data) ? root.data : [];
      for (const node of nodes) {
        const track = toSourceTrack(normalizeTrackNode(node));
        if (track?.isrc) {
          result.set(track.isrc, track);
        }
      }
    } catch {
      // Skip failed batches — tracks will fall back to search
    }
  }

  return result;
}

export async function searchTidalTracks(
  session: ProviderSession,
  query: string
): Promise<SourceTrack[]> {
  const url = buildSearchUrl(query);
  const { payload } = await fetchWithRetry(url, session);

  const trackNodes = extractTrackArray(payload);
  const tracks: SourceTrack[] = [];
  for (const node of trackNodes) {
    const mapped = toSourceTrack(normalizeTrackNode(node));
    if (mapped) {
      tracks.push(mapped);
    }
  }

  return tracks;
}

const MAX_PLAYLIST_PAGES = 5;

/**
 * Fetch the authenticated user's TIDAL playlists.
 * Uses GET /playlists?filter[owners.id]={userId} with cursor-based pagination.
 * Returns an array of { id, name } or an empty array on failure.
 */
export async function listTidalUserPlaylists(
  session: ProviderSession
): Promise<Array<{ id: string; name: string }>> {
  try {
    const config = getTidalApiConfig();
    const userId = await getTidalUserId(session);
    const playlists: Array<{ id: string; name: string }> = [];
    let cursor: string | null = null;

    for (let page = 0; page < MAX_PLAYLIST_PAGES; page++) {
      const url = new URL(`${config.apiBaseUrl}/playlists`);
      url.searchParams.set("filter[owners.id]", userId);
      url.searchParams.set("countryCode", config.countryCode);
      if (cursor) {
        url.searchParams.set("page[cursor]", cursor);
      }

      const { payload } = await fetchWithRetry(url.toString(), session);
      const root = payload as {
        data?: unknown[];
        links?: { meta?: { nextCursor?: string } };
      } | null;
      const items = Array.isArray(root?.data) ? root.data : [];

      for (const item of items) {
        if (!item || typeof item !== "object") continue;
        const node = item as { id?: unknown; attributes?: { name?: unknown } };
        const id = node.id != null ? String(node.id) : null;
        const name = getString(node.attributes?.name);
        if (id && name) {
          playlists.push({ id, name });
        }
      }

      // Check for next page cursor
      const nextCursor = root?.links?.meta?.nextCursor;
      if (!nextCursor || items.length === 0) break;
      cursor = nextCursor;

      // Safety cap
      if (playlists.length >= 500) break;
    }

    return playlists;
  } catch (err) {
    console.error(JSON.stringify({
      at: new Date().toISOString(),
      kind: "tidal_playlists_fetch",
      error: err instanceof Error ? err.message : "Unknown error"
    }));
    return [];
  }
}
