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
  const withQuery = template.includes("{query}")
    ? template.replace("{query}", encodeURIComponent(query))
    : template;

  const url = withQuery.startsWith("http")
    ? new URL(withQuery)
    : new URL(withQuery, `${config.apiBaseUrl}/`);
  if (!template.includes("{query}") && !url.searchParams.has("query")) {
    url.searchParams.set("query", query);
  }

  if (!url.searchParams.has("include")) {
    url.searchParams.set("include", "TRACKS");
  }
  if (!url.searchParams.has("limit")) {
    url.searchParams.set("limit", "10");
  }
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

  const id = getString(record.id);
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

  const durationMs = getNumber(record.durationMs) || (getNumber(record.duration) || 0) * 1000;
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
  };

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
    return {
      id: attr.id,
      title: attr.title,
      isrc: attr.isrc,
      durationMs: attr.durationMs,
      duration: attr.duration,
      artists: attr.artists
    };
  }

  if (node.item && typeof node.item === "object") {
    return node.item;
  }

  return node;
}

export async function searchTidalTracks(
  session: ProviderSession,
  query: string
): Promise<SourceTrack[]> {
  const url = buildSearchUrl(query);
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
