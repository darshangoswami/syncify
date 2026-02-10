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

function titlesMatch(sourceTitle: string, candidateTitle: string): boolean {
  const s = normalizeText(sourceTitle);
  const c = normalizeText(candidateTitle);
  return s === c || s.startsWith(c) || c.startsWith(s);
}

function hasStrictMetadataMatch(source: SourceTrack, candidate: SourceTrack): boolean {
  return (
    normalizeText(source.title) === normalizeText(candidate.title) &&
    normalizePrimaryArtist(source.artist) === normalizePrimaryArtist(candidate.artist) &&
    durationMatches(source.durationMs, candidate.durationMs)
  );
}

function artistsMatch(sourceArtist: string, candidateArtist: string): boolean {
  const s = normalizePrimaryArtist(sourceArtist);
  const c = normalizePrimaryArtist(candidateArtist);
  if (s === c) return true;
  // Partial containment: "Rabbi Shergill" vs "Rabbi" or vice versa
  return s.includes(c) || c.includes(s);
}

function hasRelaxedMetadataMatch(source: SourceTrack, candidate: SourceTrack): boolean {
  return (
    titlesMatch(source.title, candidate.title) &&
    artistsMatch(source.artist, candidate.artist) &&
    durationMatches(source.durationMs, candidate.durationMs)
  );
}

function hasSearchContextMatch(source: SourceTrack, candidate: SourceTrack): boolean {
  // When artist info is missing from the candidate (TIDAL didn't return it),
  // accept title + duration match since the search query already included the artist name
  const candidateArtistUnknown = normalizePrimaryArtist(candidate.artist) === "unknown artist";
  return (
    titlesMatch(source.title, candidate.title) &&
    (candidateArtistUnknown || artistsMatch(source.artist, candidate.artist)) &&
    durationMatches(source.durationMs, candidate.durationMs)
  );
}

export function buildDestinationSearchQuery(track: SourceTrack): string {
  return `${track.title} ${track.artist}`.trim();
}

export function matchTrackAgainstCandidates(
  sourceTrack: SourceTrack,
  destinationCandidates: SourceTrack[]
): SourceTrack | null {
  // Tier 1: ISRC match (exact identifier)
  const isrcMatch = destinationCandidates.find((candidate) => hasIsrcMatch(sourceTrack, candidate));
  if (isrcMatch) {
    return isrcMatch;
  }

  // Tier 2: Strict metadata (exact title + exact primary artist + duration)
  const strictMatch = destinationCandidates.find((candidate) => hasStrictMetadataMatch(sourceTrack, candidate));
  if (strictMatch) {
    return strictMatch;
  }

  // Tier 3: Relaxed metadata (fuzzy title + partial artist + duration)
  const relaxedMatch = destinationCandidates.find((candidate) => hasRelaxedMetadataMatch(sourceTrack, candidate));
  if (relaxedMatch) {
    return relaxedMatch;
  }

  // Tier 4: Search-context match (title + duration, tolerates missing/unknown artist)
  const contextMatch = destinationCandidates.find((candidate) => hasSearchContextMatch(sourceTrack, candidate));
  return contextMatch || null;
}
