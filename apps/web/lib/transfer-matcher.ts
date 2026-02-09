import type { SourceTrack } from "@spotify-xyz/shared";

const DURATION_TOLERANCE_MS = 2_000;

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

function hasStrictMetadataMatch(source: SourceTrack, candidate: SourceTrack): boolean {
  return (
    normalizeText(source.title) === normalizeText(candidate.title) &&
    normalizePrimaryArtist(source.artist) === normalizePrimaryArtist(candidate.artist) &&
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
  const isrcMatch = destinationCandidates.find((candidate) => hasIsrcMatch(sourceTrack, candidate));
  if (isrcMatch) {
    return isrcMatch;
  }

  const strictMatch = destinationCandidates.find((candidate) => hasStrictMetadataMatch(sourceTrack, candidate));
  return strictMatch || null;
}
