import type { SourceTrack } from "@spotify-xyz/shared";

const DURATION_TOLERANCE_MS = 10_000;

function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizePrimaryArtist(value: string): string {
  const primary = value.split(/,|&| feat\.?| ft\.?|;|\//i)[0] || value;
  return normalizeText(primary);
}

function durationMatches(sourceDurationMs?: number, destinationDurationMs?: number): boolean {
  if (!sourceDurationMs || !destinationDurationMs) {
    return true;
  }

  return Math.abs(sourceDurationMs - destinationDurationMs) <= DURATION_TOLERANCE_MS;
}

function hasIsrcMatch(source: SourceTrack, candidate: SourceTrack): boolean {
  if (!source.isrc || !candidate.isrc) {
    return false;
  }

  return source.isrc.trim().toUpperCase() === candidate.isrc.trim().toUpperCase();
}

function normalizedTitlesMatch(srcTitle: string, candTitle: string): boolean {
  return srcTitle === candTitle || srcTitle.startsWith(candTitle) || candTitle.startsWith(srcTitle);
}

function normalizedArtistsMatch(srcArtist: string, candArtist: string): boolean {
  if (srcArtist === candArtist) return true;
  return srcArtist.includes(candArtist) || candArtist.includes(srcArtist);
}

export function buildDestinationSearchQuery(track: SourceTrack): string {
  return `${track.title} ${track.artist}`.trim();
}

export function matchTrackAgainstCandidates(
  sourceTrack: SourceTrack,
  destinationCandidates: SourceTrack[]
): SourceTrack | null {
  const srcTitle = normalizeText(sourceTrack.title);
  const srcArtist = normalizePrimaryArtist(sourceTrack.artist);

  // Tier 1: ISRC match (exact identifier)
  const isrcMatch = destinationCandidates.find((candidate) => hasIsrcMatch(sourceTrack, candidate));
  if (isrcMatch) {
    return isrcMatch;
  }

  // Pre-compute normalized candidate values for tiers 2–4
  const normalized = destinationCandidates.map((candidate) => ({
    track: candidate,
    title: normalizeText(candidate.title),
    artist: normalizePrimaryArtist(candidate.artist)
  }));

  // Tier 2: Strict metadata (exact title + exact primary artist + duration)
  const strictMatch = normalized.find((c) =>
    srcTitle === c.title &&
    srcArtist === c.artist &&
    durationMatches(sourceTrack.durationMs, c.track.durationMs)
  );
  if (strictMatch) {
    return strictMatch.track;
  }

  // Tier 3: Relaxed metadata (fuzzy title + partial artist + duration)
  const relaxedMatch = normalized.find((c) =>
    normalizedTitlesMatch(srcTitle, c.title) &&
    normalizedArtistsMatch(srcArtist, c.artist) &&
    durationMatches(sourceTrack.durationMs, c.track.durationMs)
  );
  if (relaxedMatch) {
    return relaxedMatch.track;
  }

  // Tier 4: Search-context match (title + duration, tolerates missing/unknown artist)
  const contextMatch = normalized.find((c) =>
    normalizedTitlesMatch(srcTitle, c.title) &&
    (c.artist === "unknown artist" || normalizedArtistsMatch(srcArtist, c.artist)) &&
    durationMatches(sourceTrack.durationMs, c.track.durationMs)
  );
  return contextMatch?.track || null;
}
