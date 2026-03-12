import { describe, expect, it } from "vitest";
import type { SourceTrack } from "@syncify/shared";
import { matchTrackAgainstCandidates } from "@/lib/transfer-matcher";

describe("transfer matcher", () => {
  it("matches by ISRC first", () => {
    const sourceTrack: SourceTrack = {
      id: "source-1",
      title: "Song A",
      artist: "Artist A",
      isrc: "USABC1234567",
      durationMs: 180000
    };
    const candidates: SourceTrack[] = [
      {
        id: "tidal-1",
        title: "Different title",
        artist: "Different artist",
        isrc: "USABC1234567",
        durationMs: 201000
      }
    ];

    const match = matchTrackAgainstCandidates(sourceTrack, candidates);
    expect(match?.id).toBe("tidal-1");
  });

  it("falls back to strict metadata when ISRC is missing", () => {
    const sourceTrack: SourceTrack = {
      id: "source-2",
      title: "Skyline (Radio Edit)",
      artist: "Nova feat. Sky",
      durationMs: 200000
    };
    const candidates: SourceTrack[] = [
      {
        id: "tidal-2",
        title: "Skyline Radio Edit",
        artist: "Nova",
        durationMs: 201500
      }
    ];

    const match = matchTrackAgainstCandidates(sourceTrack, candidates);
    expect(match?.id).toBe("tidal-2");
  });

  it("returns null when no candidates match", () => {
    const sourceTrack: SourceTrack = {
      id: "source-3",
      title: "Unknown Track",
      artist: "Unknown Artist",
      durationMs: 210000
    };
    const candidates: SourceTrack[] = [
      {
        id: "tidal-3",
        title: "Completely Different",
        artist: "Another Artist",
        durationMs: 210000
      }
    ];

    const match = matchTrackAgainstCandidates(sourceTrack, candidates);
    expect(match).toBeNull();
  });
});
