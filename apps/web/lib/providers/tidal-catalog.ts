import type { SourceTrack } from "@spotify-xyz/shared";
import type { ProviderSession } from "@/lib/provider-session";
import { getTidalApiConfig } from "@/lib/env";

class TidalApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "TidalApiError";
    this.status = status;
  }
}

function getString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function getNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
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

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getAuthHeader(session: ProviderSession): string {
  return `${session.tokenType || "Bearer"} ${session.accessToken}`;
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

const THROTTLE_MS = 250;
const MAX_RETRIES = 4;
const RETRY_BASE_MS = 1000;

export async function searchTidalTracks(
  session: ProviderSession,
  query: string
): Promise<SourceTrack[]> {
  const url = buildSearchUrl(query);

  let response: Response | null = null;
  let payload: unknown = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    if (attempt > 0) {
      await delay(RETRY_BASE_MS * Math.pow(2, attempt - 1));
    } else {
      await delay(THROTTLE_MS);
    }

    response = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: getAuthHeader(session)
      }
    });

    if (response.status !== 429) break;
  }

  if (!response) {
    throw new TidalApiError("TIDAL API request failed after retries.", 429);
  }

  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) {
    throw new TidalApiError("TIDAL API request failed.", response.status);
  }

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
