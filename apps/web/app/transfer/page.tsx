"use client";

import type {
  TidalExistingPlaylist,
  TransferChunkResult,
  TransferMatchedTrack,
  TransferPreviewPlaylistBreakdown,
  TransferPreviewResultV2,
  TransferPreviewUnmatchedTrack
} from "@spotify-xyz/shared";
import type { ReactElement } from "react";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

/* ──────────────────────────── Types ──────────────────────────── */

type TransferPhase = "preview" | "progress" | "results";

interface ProgressState {
  currentPlaylistName: string;
  currentTrackTitle: string;
  currentTrackArtist: string;
  processedTracks: number;
  totalTracks: number;
  added: number;
  skipped: number;
  failed: number;
  failedTracks: Array<{ trackId: string; title: string; artist: string; reason: string }>;
  cancelled: boolean;
}

/* ──────────────────────────── Constants ──────────────────────── */

const CHUNK_SIZE = 20;
const MAX_RETRIES = 3;
const RETRY_BASE_MS = 2000;

/* ──────────────────────────── Inner component ────────────────── */

function TransferPageInner(): ReactElement {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [phase, setPhase] = useState<TransferPhase>("preview");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [preview, setPreview] = useState<TransferPreviewResultV2 | null>(null);
  const [previewProgress, setPreviewProgress] = useState({
    current: 0,
    total: 0,
    currentName: ""
  });
  const [progress, setProgress] = useState<ProgressState>({
    currentPlaylistName: "",
    currentTrackTitle: "",
    currentTrackArtist: "",
    processedTracks: 0,
    totalTracks: 0,
    added: 0,
    skipped: 0,
    failed: 0,
    failedTracks: [],
    cancelled: false
  });
  const [copied, setCopied] = useState(false);
  const [existingPlaylists, setExistingPlaylists] = useState<TidalExistingPlaylist[]>([]);
  const [allowDuplicatePlaylists, setAllowDuplicatePlaylists] = useState(true);
  const cancelledRef = useRef(false);
  const chunkTimesRef = useRef<number[]>([]);
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);

  /* ──── Wake Lock helpers ──── */
  async function acquireWakeLock(): Promise<void> {
    try {
      if ("wakeLock" in navigator) {
        wakeLockRef.current = await navigator.wakeLock.request("screen");
      }
    } catch { /* not supported or denied — fine */ }
  }

  async function releaseWakeLock(): Promise<void> {
    try {
      await wakeLockRef.current?.release();
      wakeLockRef.current = null;
    } catch { /* ignore */ }
  }

  // Re-acquire wake lock when tab becomes visible again (it's auto-released on hide)
  useEffect(() => {
    function handleVisibility(): void {
      if (document.visibilityState === "visible" && (loading || phase === "progress")) {
        void acquireWakeLock();
      }
    }
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      void releaseWakeLock();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, phase]);

  /* ──── Parse params ──── */
  const playlistIdsParam = searchParams.get("playlists") || "";
  const includeLiked = searchParams.get("liked") === "true";
  const namesParam = searchParams.get("names") || "{}";
  const allowDuplicates = searchParams.get("dupes") === "true";

  const playlistIds = playlistIdsParam ? playlistIdsParam.split(",").filter(Boolean) : [];
  let playlistNames: Record<string, string> = {};
  try {
    playlistNames = JSON.parse(namesParam) as Record<string, string>;
  } catch {
    /* ignore */
  }

  function normalizePlaylistName(name: string): string {
    return name.trim().replace(/\s+/g, " ").toLowerCase();
  }

  /* ──── Fetch preview ──── */
  const fetchPreview = useCallback(async () => {
    setLoading(true);
    setError("");
    await acquireWakeLock();

    // Build list of units to fetch (liked + playlists)
    const fetchUnits: Array<{ id: string; name: string }> = [];
    if (includeLiked) {
      fetchUnits.push({ id: "liked", name: "Liked Songs" });
    }
    for (const playlistId of playlistIds) {
      fetchUnits.push({
        id: playlistId,
        name: playlistNames[playlistId] || `Playlist ${playlistId}`
      });
    }

    setPreviewProgress({ current: 0, total: fetchUnits.length, currentName: "" });

    // Fetch existing TIDAL playlists for duplicate detection
    let fetchedTidalPlaylists: Array<{ id: string; name: string }> = [];
    try {
      const tidalRes = await fetch("/api/transfer/tidal-playlists");
      if (tidalRes.ok) {
        const tidalData = (await tidalRes.json()) as { playlists: Array<{ id: string; name: string }> };
        fetchedTidalPlaylists = tidalData.playlists || [];
      }
    } catch {
      // Non-critical — continue without duplicate detection
    }

    // Aggregate results from each unit
    let totalMatched = 0;
    let totalUnmatched = 0;
    let totalSourceTracks = 0;
    let duplicatesRemoved = 0;
    let unavailableTracks = 0;
    const allUnmatchedTracks: TransferPreviewUnmatchedTrack[] = [];
    const allPlaylists: TransferPreviewPlaylistBreakdown[] = [];

    // Fetch each playlist sequentially
    for (let i = 0; i < fetchUnits.length; i++) {
      const unit = fetchUnits[i]!;

      setPreviewProgress({
        current: i,
        total: fetchUnits.length,
        currentName: unit.name
      });

      try {
        const res = await fetch("/api/transfer/preview", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sourceProvider: "spotify",
            destinationProvider: "tidal",
            playlistIds: unit.id === "liked" ? undefined : [unit.id],
            includeLiked: unit.id === "liked",
            playlistNames: playlistNames,
            allowDuplicates: allowDuplicates,
            filterPlaylistId: unit.id
          })
        });

        if (!res.ok) {
          const data = (await res.json().catch(() => ({}))) as { error?: string };
          setError(data.error || `Preview failed for ${unit.name}`);
          setLoading(false);
          void releaseWakeLock();
          return;
        }

        const data = (await res.json()) as { preview: TransferPreviewResultV2 };
        const partial = data.preview;

        // Aggregate
        totalMatched += partial.matched;
        totalUnmatched += partial.unmatched;
        totalSourceTracks += partial.totalSourceTracks;
        duplicatesRemoved += partial.duplicatesRemoved;
        unavailableTracks += partial.unavailableTracks;
        allUnmatchedTracks.push(...partial.unmatchedTracks);
        allPlaylists.push(...partial.playlists);

      } catch (err) {
        setError(`Failed to load preview for ${unit.name}`);
        setLoading(false);
        void releaseWakeLock();
        return;
      }
    }

    // Build full preview
    const fullPreview: TransferPreviewResultV2 = {
      matched: totalMatched,
      unmatched: totalUnmatched,
      totalSourceTracks: totalSourceTracks,
      duplicatesRemoved: duplicatesRemoved,
      unavailableTracks: unavailableTracks,
      unmatchedTracks: allUnmatchedTracks,
      playlists: allPlaylists
    };

    // Match source playlists against existing TIDAL playlists (case-insensitive name match)
    if (fetchedTidalPlaylists.length > 0) {
      const tidalNameMap = new Map<string, { id: string; name: string }>();
      for (const tp of fetchedTidalPlaylists) {
        tidalNameMap.set(normalizePlaylistName(tp.name), tp);
      }

      const matched: TidalExistingPlaylist[] = [];
      for (const p of allPlaylists) {
        // Skip Liked Songs — it's favorites, not a named playlist
        if (p.playlistId === "liked") continue;
        const tidalMatch = tidalNameMap.get(normalizePlaylistName(p.playlistName));
        if (tidalMatch) {
          matched.push({
            tidalPlaylistId: tidalMatch.id,
            tidalPlaylistName: tidalMatch.name,
            sourcePlaylistId: p.playlistId,
            sourcePlaylistName: p.playlistName
          });
        }
      }
      setExistingPlaylists(matched);
    } else {
      setExistingPlaylists([]);
    }

    setPreview(fullPreview);
    setLoading(false);
    void releaseWakeLock();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    void fetchPreview();
  }, [fetchPreview]);

  /* ──── Transfer execution ──── */
  async function sendChunkWithRetry(body: Record<string, unknown>): Promise<TransferChunkResult | null> {
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        const res = await fetch("/api/transfer/chunk", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body)
        });

        if (res.status === 429 && attempt < MAX_RETRIES) {
          await new Promise((r) => setTimeout(r, RETRY_BASE_MS * Math.pow(2, attempt)));
          continue;
        }

        if (res.status === 401) {
          setError((prev) => prev || "Your TIDAL session has expired. Please reconnect.");
          return null;
        }

        if (!res.ok) {
          const data = (await res.json().catch(() => ({}))) as { error?: string };
          setError((prev) => prev || data.error || `Chunk failed (${res.status})`);
          return null;
        }

        const data = (await res.json()) as { result: TransferChunkResult };
        return data.result;
      } catch {
        if (attempt < MAX_RETRIES) {
          await new Promise((r) => setTimeout(r, RETRY_BASE_MS * Math.pow(2, attempt)));
          continue;
        }
        return null;
      }
    }
    return null;
  }

  async function startTransfer(): Promise<void> {
    if (!preview) return;

    cancelledRef.current = false;
    setPhase("progress");
    await acquireWakeLock();
    chunkTimesRef.current = [];

    // Build ordered queue: playlist by playlist
    interface PlaylistQueue {
      playlistId: string;
      playlistName: string;
      tracks: TransferMatchedTrack[];
    }

    // Filter out playlists that already exist on TIDAL (unless user opted in)
    const excludedIds = !allowDuplicatePlaylists
      ? new Set(existingPlaylists.map((ep) => ep.sourcePlaylistId))
      : new Set<string>();

    const queue: PlaylistQueue[] = preview.playlists
      .filter((p) => !excludedIds.has(p.playlistId))
      .map((p) => ({
        playlistId: p.playlistId,
        playlistName: p.playlistName,
        tracks: p.matchedTracks
      }));

    const totalTracks = queue.reduce((sum, p) => sum + p.tracks.length, 0);
    let processedTracks = 0;
    let added = 0;
    let skipped = 0;
    let failed = 0;
    const failedTracks: ProgressState["failedTracks"] = [];

    setProgress({
      currentPlaylistName: "",
      currentTrackTitle: "",
      currentTrackArtist: "",
      processedTracks: 0,
      totalTracks,
      added: 0,
      skipped: 0,
      failed: 0,
      failedTracks: [],
      cancelled: false
    });

    for (const playlist of queue) {
      if (cancelledRef.current) break;

      let destinationPlaylistId: string | undefined;
      const chunks: TransferMatchedTrack[][] = [];

      for (let i = 0; i < playlist.tracks.length; i += CHUNK_SIZE) {
        chunks.push(playlist.tracks.slice(i, i + CHUNK_SIZE));
      }

      for (let ci = 0; ci < chunks.length; ci++) {
        const chunk = chunks[ci]!;
        if (cancelledRef.current) break;

        // Update current track display
        const firstTrack = chunk[0];
        setProgress((prev) => ({
          ...prev,
          currentPlaylistName: playlist.playlistName,
          currentTrackTitle: firstTrack?.title || "",
          currentTrackArtist: firstTrack?.artist || ""
        }));

        const chunkStart = Date.now();
        const result = await sendChunkWithRetry({
          destinationProvider: "tidal",
          playlistId: playlist.playlistId,
          playlistName: playlist.playlistName,
          destinationPlaylistId,
          trackIds: chunk.map((t) => t.destinationTrackId)
        });
        chunkTimesRef.current.push(Date.now() - chunkStart);

        if (!result) {
          if (!destinationPlaylistId) {
            // Playlist creation failed — skip all remaining chunks, retrying won't help
            for (const rc of chunks.slice(ci)) {
              failed += rc.length;
              for (const t of rc) {
                failedTracks.push({
                  trackId: t.destinationTrackId,
                  title: t.title,
                  artist: t.artist,
                  reason: "Playlist creation failed"
                });
              }
              processedTracks += rc.length;
            }
            setProgress((prev) => ({
              ...prev,
              processedTracks,
              added,
              skipped,
              failed,
              failedTracks: [...failedTracks]
            }));
            break;
          }

          // Playlist exists but chunk failed — mark this chunk and continue
          failed += chunk.length;
          for (const t of chunk) {
            failedTracks.push({
              trackId: t.destinationTrackId,
              title: t.title,
              artist: t.artist,
              reason: "Chunk request failed"
            });
          }
          processedTracks += chunk.length;
          setProgress((prev) => ({
            ...prev,
            processedTracks,
            added,
            skipped,
            failed,
            failedTracks: [...failedTracks]
          }));
          continue;
        }

        if (result.destinationPlaylistId) {
          destinationPlaylistId = result.destinationPlaylistId;
        }

        added += result.added;
        skipped += result.skipped;
        failed += result.failed;
        for (const ft of result.failedTracks) {
          const matched = chunk.find((t) => t.destinationTrackId === ft.trackId);
          failedTracks.push({
            trackId: ft.trackId,
            title: matched?.title || ft.trackId,
            artist: matched?.artist || "",
            reason: ft.reason
          });
        }
        processedTracks += chunk.length;

        setProgress((prev) => ({
          ...prev,
          processedTracks,
          added,
          skipped,
          failed,
          failedTracks: [...failedTracks]
        }));
      }
    }

    setProgress((prev) => ({
      ...prev,
      processedTracks,
      added,
      skipped,
      failed,
      failedTracks: [...failedTracks],
      cancelled: cancelledRef.current
    }));
    setPhase("results");
    void releaseWakeLock();
  }

  function stopTransfer(): void {
    cancelledRef.current = true;
  }

  /* ──── Computed values ──── */
  const percentComplete = progress.totalTracks > 0
    ? Math.round((progress.processedTracks / progress.totalTracks) * 100)
    : 0;

  const avgChunkTime = chunkTimesRef.current.length > 0
    ? chunkTimesRef.current.reduce((a, b) => a + b, 0) / chunkTimesRef.current.length
    : 0;
  const remainingChunks = progress.totalTracks > 0
    ? Math.ceil((progress.totalTracks - progress.processedTracks) / CHUNK_SIZE)
    : 0;
  const estimatedMs = remainingChunks * avgChunkTime;
  const estimatedMinutes = Math.max(1, Math.ceil(estimatedMs / 60000));

  // Effective values accounting for skipped duplicate playlists
  const duplicatePlaylistIds = new Set(existingPlaylists.map((ep) => ep.sourcePlaylistId));
  const effectivePlaylists = preview
    ? (allowDuplicatePlaylists
        ? preview.playlists
        : preview.playlists.filter((p) => !duplicatePlaylistIds.has(p.playlistId)))
    : [];
  const effectiveMatched = effectivePlaylists.reduce((sum, p) => sum + p.matchedCount, 0);
  const effectiveTotal = effectivePlaylists.reduce((sum, p) => sum + p.totalTracks, 0);
  const effectiveUnmatched = effectivePlaylists.reduce((sum, p) => sum + p.unmatchedCount, 0);
  const effectivePlaylistIds = new Set(effectivePlaylists.map((playlist) => playlist.playlistId));
  const effectiveUnmatchedTracks = preview
    ? preview.unmatchedTracks.filter((track) => effectivePlaylistIds.has(track.playlistId))
    : [];
  const skippedPlaylistTrackCount = preview
    ? Math.max(0, preview.totalSourceTracks - effectiveTotal)
    : 0;

  const matchRate = effectiveTotal > 0
    ? ((effectiveMatched / effectiveTotal) * 100).toFixed(1)
    : "0";

  /* ──── Build unmatched report text ──── */
  function buildUnmatchedText(): string {
    const lines: string[] = [];
    if (effectiveUnmatchedTracks.length) {
      lines.push("UNMATCHED TRACKS:");
      for (const t of effectiveUnmatchedTracks) {
        lines.push(`  ${t.title} - ${t.artist} (${t.reason === "no_destination_match" ? "no match found" : "lookup failed"})`);
      }
    }
    if (progress.failedTracks.length > 0) {
      if (lines.length > 0) lines.push("");
      lines.push("FAILED TRACKS:");
      for (const t of progress.failedTracks) {
        lines.push(`  ${t.title} - ${t.artist} (${t.reason})`);
      }
    }
    return lines.join("\n");
  }

  async function copyReport(): Promise<void> {
    try {
      await navigator.clipboard.writeText(buildUnmatchedText());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard not available */
    }
  }

  /* ──── Playlist icon colors ──── */
  const iconColors = ["bg-[#7C3AED]", "bg-[#3B82F6]", "bg-primary", "bg-[#F59E0B]", "bg-[#EC4899]"];
  const iconNames = ["favorite", "nightlife", "bolt", "library_music", "headphones"];

  /* ──────────────────────────── Loading ──────────────────────── */
  if (loading) {
    return (
      <div className="min-h-dvh bg-background-dark flex flex-col items-center justify-center">
        <div className="relative w-12 h-12 mb-4">
          <div className="absolute inset-0 border-4 border-dashed border-primary rounded-full animate-spin" />
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="material-icons-round text-primary">sync</span>
          </div>
        </div>
        <p className="text-zinc-500 text-sm font-bold">
          Preparing preview... ({previewProgress.current}/{previewProgress.total})
        </p>
        {previewProgress.currentName && (
          <p className="text-zinc-400 text-xs mt-2">
            {previewProgress.currentName}
          </p>
        )}
        <p className="text-zinc-600 text-[11px] mt-6">Keep your screen on until the preview is ready.</p>
      </div>
    );
  }

  /* ──────────────────────────── Error ─────────────────────────── */
  if (error && phase !== "progress" && phase !== "results") {
    return (
      <div className="min-h-dvh bg-background-dark flex flex-col items-center justify-center px-8 text-center">
        <span className="material-icons-round text-red-500 text-5xl mb-4">error_outline</span>
        <p className="text-white font-bold text-lg mb-2">Something went wrong</p>
        <p className="text-zinc-400 text-sm mb-6">{error}</p>
        <Link
          href="/connections"
          className="bg-zinc-800 text-white font-bold py-3 px-6 rounded-2xl transition-all active:scale-95"
        >
          Reconnect Providers
        </Link>
      </div>
    );
  }

  /* ══════════════════════════════════════════════════════════════ */
  /*                    PHASE 1: PREVIEW                          */
  /* ══════════════════════════════════════════════════════════════ */
  if (phase === "preview" && preview) {
    const matchedPercent = effectiveTotal > 0
      ? Math.round((effectiveMatched / effectiveTotal) * 100)
      : 0;

    return (
      <div className="min-h-dvh bg-background-dark flex flex-col antialiased overflow-x-hidden">
        {/* Header */}
        <header className="w-full max-w-5xl mx-auto px-6 py-8 flex items-center gap-4">
          <Link
            href="/select-sources"
            className="w-10 h-10 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center hover:bg-zinc-700 transition-colors"
          >
            <span className="material-icons-round">arrow_back</span>
          </Link>
          <h1 className="text-2xl font-bold">Transfer Preview</h1>
        </header>

        {/* Main */}
        <main className="flex-grow w-full max-w-5xl mx-auto px-6 pb-44">
          {/* Hero + Sync source */}
          <div className="mb-10 flex flex-col items-center gap-6">
            {/* Hero card */}
            <section className="relative bg-primary w-full max-w-2xl rounded-2xl p-8 overflow-hidden shadow-lg">
              <div className="absolute top-0 right-0 p-6 opacity-50 pointer-events-none">
                <svg fill="none" height="40" viewBox="0 0 120 40" width="120">
                  <path className="text-green-800" d="M0 20C20 20 20 0 40 0C60 0 60 40 80 40C100 40 100 20 120 20" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" />
                  <circle className="text-green-800" cx="100" cy="8" fill="currentColor" r="6" />
                </svg>
              </div>
              <div className="relative z-10 flex flex-col items-center text-center">
                <p className="text-green-900 font-semibold text-sm tracking-wider uppercase mb-2">Ready to move</p>
                <div className="flex items-baseline justify-center gap-2 mb-6">
                  <span className="text-6xl font-extrabold text-black">{effectiveMatched.toLocaleString()}</span>
                  <span className="text-2xl font-bold text-black">Songs</span>
                </div>
                <div className="w-full max-w-md bg-green-800/30 rounded-full h-2.5 mb-3">
                  <div className="bg-black h-2.5 rounded-full" style={{ width: `${matchedPercent}%` }} />
                </div>
                <div className="flex items-center justify-between w-full max-w-md text-sm font-medium text-green-950">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-black" />
                    <span>{effectiveMatched} Matched</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-green-200" />
                    <span className="text-green-100">{effectiveTotal - effectiveMatched} Unmatched</span>
                  </div>
                </div>
              </div>
            </section>

            {/* Track accounting note */}
            {(preview.duplicatesRemoved > 0 || preview.unavailableTracks > 0 || allowDuplicates || skippedPlaylistTrackCount > 0) && (
              <p className="text-center text-xs text-zinc-500">
                {(preview.totalSourceTracks + preview.duplicatesRemoved + preview.unavailableTracks).toLocaleString()} total
                {preview.unavailableTracks > 0 && ` · ${preview.unavailableTracks.toLocaleString()} unavailable`}
                {preview.duplicatesRemoved > 0 && !allowDuplicates && ` · ${preview.duplicatesRemoved.toLocaleString()} duplicates removed`}
                {allowDuplicates && " · duplicates included"}
                {skippedPlaylistTrackCount > 0 && ` · ${skippedPlaylistTrackCount.toLocaleString()} in skipped name-matches`}
              </p>
            )}

            {/* Sync source indicator */}
            <section className="bg-card-dark border border-zinc-700 rounded-xl p-4 flex items-center justify-between w-full max-w-2xl">
              <div className="flex items-center gap-4">
                <div className="flex -space-x-3">
                  <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center ring-2 ring-card-dark z-10">
                    <span className="material-icons-round text-white text-sm">music_note</span>
                  </div>
                  <div className="w-10 h-10 rounded-full bg-black flex items-center justify-center ring-2 ring-card-dark z-0">
                    <span className="material-icons-round text-white text-sm">waves</span>
                  </div>
                </div>
                <div>
                  <p className="text-xs text-zinc-400 uppercase tracking-wider font-semibold">Syncing from</p>
                  <p className="font-semibold">Spotify to TIDAL</p>
                </div>
              </div>
              <span className="material-icons-round text-primary">sync_alt</span>
            </section>
          </div>

          {/* 2-column grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Left — Playlists breakdown */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold">Playlists breakdown</h2>
                <span className="text-sm text-zinc-500">{effectivePlaylists.length} total</span>
              </div>
              <div className="space-y-3">
                {preview.playlists.map((playlist, idx) => {
                  const pctMatch = playlist.totalTracks > 0
                    ? Math.round((playlist.matchedCount / playlist.totalTracks) * 100)
                    : 0;
                  const isLiked = playlist.playlistId === "liked";
                  const color = isLiked ? "bg-[#7C3AED]" : iconColors[idx % iconColors.length];
                  const icon = isLiked ? "favorite" : iconNames[idx % iconNames.length];
                  const isExcluded = !allowDuplicatePlaylists && duplicatePlaylistIds.has(playlist.playlistId);

                  return (
                    <div
                      key={playlist.playlistId}
                      className={`bg-card-dark border border-zinc-700 rounded-xl p-4 flex items-center gap-4 hover:border-zinc-600 transition-colors ${isExcluded ? "opacity-40" : ""}`}
                    >
                      <div className={`w-14 h-14 ${color} rounded-xl flex items-center justify-center shrink-0 shadow-inner`}>
                        <span className="material-icons-round text-white">{icon}</span>
                      </div>
                      <div className="flex-grow min-w-0">
                        <h3 className="font-semibold truncate">{playlist.playlistName}</h3>
                        <p className="text-sm text-zinc-500">{playlist.matchedCount} songs matched</p>
                      </div>
                      <div className="text-right shrink-0">
                        {isExcluded ? (
                          <>
                            <p className="font-bold text-amber-500">Skipped</p>
                            <p className="text-[10px] text-zinc-500 uppercase tracking-wider font-bold">Already on TIDAL</p>
                          </>
                        ) : playlist.unmatchedCount > 0 ? (
                          <>
                            <p className="font-bold text-yellow-500">{playlist.unmatchedCount} unmatched</p>
                            <p className="text-[10px] text-zinc-500 uppercase tracking-wider font-bold">Review needed</p>
                          </>
                        ) : (
                          <>
                            <p className="font-bold text-primary">{pctMatch}%</p>
                            <p className="text-[10px] text-zinc-500 uppercase tracking-wider font-bold">
                              {pctMatch === 100 ? "All found" : "Perfect Match"}
                            </p>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Right — Already on TIDAL + warnings */}
            <div>
              {existingPlaylists.length > 0 && (
                <>
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-bold">Already on TIDAL</h2>
                    <span className="text-sm text-zinc-500">{existingPlaylists.length} found</span>
                  </div>
                  {existingPlaylists.map((ep) => (
                    <div key={ep.sourcePlaylistId} className="bg-yellow-900/20 border border-yellow-700/50 rounded-xl p-4 flex items-center gap-3 mb-4 text-yellow-500">
                      <span className="material-icons-round text-lg">playlist_play</span>
                      <span className="font-medium text-sm">{ep.sourcePlaylistName}</span>
                    </div>
                  ))}
                  <div className="mb-6">
                    <div
                      role="checkbox"
                      aria-checked={allowDuplicatePlaylists}
                      tabIndex={0}
                      className="flex items-start gap-3 cursor-pointer group"
                      onClick={() => setAllowDuplicatePlaylists((v) => !v)}
                      onKeyDown={(e) => { if (e.key === " " || e.key === "Enter") { e.preventDefault(); setAllowDuplicatePlaylists((v) => !v); } }}
                    >
                      <div className="relative flex items-center justify-center mt-0.5">
                        <div
                          className={`w-5 h-5 rounded border-2 ${
                            allowDuplicatePlaylists ? "border-primary bg-primary" : "border-zinc-600 bg-transparent"
                          } flex items-center justify-center transition-colors`}
                        >
                          {allowDuplicatePlaylists && (
                            <span className="material-icons-round text-white text-[16px] leading-none">check</span>
                          )}
                        </div>
                      </div>
                      <div>
                        <p className="font-semibold mb-1 group-hover:text-primary transition-colors">Create playlists even if names already exist</p>
                        <p className="text-sm text-zinc-500 leading-relaxed">Name matches are heuristic only. Turn this off only if you want to skip same-name playlists.</p>
                      </div>
                    </div>
                  </div>
                </>
              )}

              {/* Warning for unmatched */}
              {effectiveUnmatched > 0 && (
                <div className="bg-yellow-900/10 border border-yellow-700/50 rounded-xl p-4 flex items-start gap-3 relative overflow-hidden">
                  <span className="material-icons-round text-yellow-500 mt-0.5">warning</span>
                  <p className="text-sm text-yellow-500 font-medium leading-relaxed">
                    {effectiveUnmatched} songs couldn&apos;t be automatically matched. You can review them after the transfer is complete.
                  </p>
                  <div className="absolute -right-4 -bottom-4 w-16 h-16 border-2 border-dashed border-yellow-500/20 rounded-full" />
                </div>
              )}
            </div>
          </div>
        </main>

        {/* Fixed bottom CTA */}
        <div className="fixed bottom-0 left-0 w-full bg-background-dark/90 backdrop-blur-md border-t border-zinc-800 p-6 pb-7 z-50">
          <div className="max-w-5xl mx-auto flex flex-col items-center">
            <button
              className="w-full max-w-md bg-primary hover:bg-green-500 text-black font-bold text-lg py-4 px-8 rounded-full shadow-[0_0_20px_rgba(34,197,94,0.3)] transition-all active:scale-[0.98] flex items-center justify-center gap-2"
              onClick={() => void startTransfer()}
            >
              START TRANSFER
              <span className="material-icons-round text-black">arrow_forward</span>
            </button>
          </div>
        </div>

        {/* Progress bar */}
        <div className="fixed bottom-0 left-0 right-0 h-1 flex z-50">
          <div className="h-full bg-zinc-800 flex-1" />
          <div className="h-full bg-primary flex-1 shadow-[0_0_10px_rgba(34,197,94,0.5)]" />
          <div className="h-full bg-zinc-800 flex-1" />
        </div>
      </div>
    );
  }

  /* ══════════════════════════════════════════════════════════════ */
  /*                    PHASE 2: PROGRESS                         */
  /* ══════════════════════════════════════════════════════════════ */
  if (phase === "progress") {
    const circumference = 2 * Math.PI * 45; // r=45
    const strokeOffset = circumference - (circumference * percentComplete) / 100;

    return (
      <div className="min-h-dvh bg-background-dark text-white flex flex-col antialiased">
        {/* Header */}
        <header className="w-full max-w-4xl mx-auto px-6 py-8 flex items-center gap-4">
          <div className="w-10 h-10 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center opacity-50">
            <span className="material-icons-round">arrow_back</span>
          </div>
          <h1 className="text-2xl font-bold">Transfer</h1>
        </header>

        <main className="flex-grow w-full max-w-4xl mx-auto px-6 pb-12 relative">
            {/* Floating stickers - hidden on mobile */}
            <div className="absolute top-10 right-10 bg-purple-600 rounded-xl p-3 shadow-lg rotate-12 hidden md:block animate-float" style={{ animationDelay: "0.5s" }}>
              <span className="material-icons-round text-white">music_note</span>
            </div>
            <div className="absolute bottom-40 left-10 bg-yellow-400 rounded-full p-3 shadow-lg -rotate-12 hidden md:block animate-float">
              <span className="material-icons-round text-black">auto_awesome</span>
            </div>

            {/* Info */}
            <div className="text-center mb-12">
              <div className="inline-block px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-bold tracking-wider uppercase mb-4">
                Live Transfer
              </div>
              <h2 className="text-3xl md:text-4xl font-bold mb-2">{progress.currentPlaylistName || "Starting..."}</h2>
              <p className="text-zinc-400 text-lg">
                Processing ({progress.processedTracks}/{progress.totalTracks})
              </p>
            </div>

            {/* SVG Progress ring */}
            <div className="flex justify-center mb-16 relative">
              <div className="relative w-64 h-64 md:w-80 md:h-80">
                <svg className="w-full h-full" viewBox="0 0 100 100">
                  <circle
                    className="text-zinc-800"
                    cx="50" cy="50" r="45"
                    fill="none" stroke="currentColor" strokeWidth="8"
                  />
                  <circle
                    className="text-primary"
                    cx="50" cy="50" r="45"
                    fill="none" stroke="currentColor" strokeWidth="8"
                    strokeLinecap="round"
                    strokeDasharray={circumference}
                    strokeDashoffset={strokeOffset}
                    style={{ transition: "stroke-dashoffset 0.35s", transform: "rotate(-90deg)", transformOrigin: "50% 50%" }}
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                  <div className="w-12 h-12 rounded-full border border-dashed border-primary flex items-center justify-center mb-3">
                    <span className="material-icons-round text-primary animate-spin">sync</span>
                  </div>
                  <span className="text-5xl md:text-6xl font-bold tracking-tighter mb-1">{percentComplete}%</span>
                  <span className="text-sm text-zinc-400 font-medium uppercase tracking-wider">
                    {avgChunkTime > 0 ? `Est. ${estimatedMinutes} min` : "Calculating..."}
                  </span>
                </div>
              </div>
            </div>

            {/* Now playing card */}
            <div className="bg-zinc-800 rounded-2xl p-6 mb-8 border border-zinc-700 shadow-sm flex items-center gap-6">
              <div className="w-16 h-16 rounded-xl bg-purple-600/20 flex items-center justify-center shrink-0">
                <span className="material-icons-round text-purple-400 text-3xl">play_arrow</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-primary text-sm font-semibold mb-1">Moving now</p>
                <h3 className="text-xl font-bold truncate mb-3">
                  {progress.currentTrackTitle
                    ? `${progress.currentTrackTitle} — ${progress.currentTrackArtist}`
                    : "Preparing..."}
                </h3>
                <div className="flex items-center gap-3">
                  <span className="px-2 py-1 rounded bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-xs font-bold uppercase tracking-wide border border-green-200 dark:border-green-800">Spotify</span>
                  <span className="material-icons-round text-zinc-400 text-sm">arrow_forward</span>
                  <span className="px-2 py-1 rounded bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 text-xs font-bold uppercase tracking-wide border border-zinc-300 dark:border-zinc-700">TIDAL</span>
                </div>
              </div>
            </div>

            {/* Stop button */}
            <div className="flex flex-col items-center">
              <button
                className="w-full md:w-auto px-8 py-4 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white font-semibold text-lg flex items-center justify-center gap-3 transition-colors mb-4 border border-zinc-700"
                onClick={stopTransfer}
              >
                <span className="w-4 h-4 rounded bg-red-500 block" />
                Stop Transfer
              </button>
              <p className="text-sm text-zinc-400 text-center">
                Keep your screen on and don&apos;t close the app during the transfer.
              </p>
            </div>
          </main>
      </div>
    );
  }

  /* ══════════════════════════════════════════════════════════════ */
  /*                    PHASE 3: RESULTS                          */
  /* ══════════════════════════════════════════════════════════════ */
  if (phase === "results") {
    const unmatchedText = buildUnmatchedText();
    const hasUnmatched = unmatchedText.length > 0;

    return (
      <div className="min-h-dvh bg-zinc-50 dark:bg-background-dark text-zinc-900 dark:text-white flex flex-col items-center py-12 px-4 sm:px-6 lg:px-8">
        <div className="w-full max-w-4xl flex flex-col gap-10">
          {/* Header */}
          <div className="flex items-start justify-between relative">
            <div className="flex flex-col gap-4">
              <button
                className="w-10 h-10 rounded-full bg-zinc-200 dark:bg-zinc-800 flex items-center justify-center hover:bg-zinc-300 dark:hover:bg-zinc-700 transition-colors"
                onClick={() => router.push("/select-sources")}
              >
                <span className="material-icons-round text-zinc-700 dark:text-white">arrow_back</span>
              </button>
              <div>
                <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight mb-2">
                  Transfer<br />
                  <span className="text-primary">{progress.cancelled ? "Stopped" : "Complete"}</span>
                </h1>
                <p className="text-zinc-500 dark:text-zinc-400 max-w-md mt-4 text-sm sm:text-base leading-relaxed">
                  {progress.cancelled
                    ? "Transfer was stopped. Partial results are shown below."
                    : "Your Spotify library has been successfully moved to TIDAL."}
                </p>
              </div>
            </div>
            {/* Decorative SVG */}
            <div className="absolute top-0 right-0 hidden sm:block opacity-50 pointer-events-none">
              <svg fill="none" height="64" viewBox="0 0 64 64" width="64">
                <circle cx="32" cy="32" r="16" stroke="#22C55E" strokeWidth="4" />
                <path d="M4 4L20 20M60 4L44 20M4 60L20 44M60 60L44 44" stroke="#333" strokeLinecap="round" strokeWidth="2" />
              </svg>
            </div>
          </div>

          {/* Info line */}
          {preview && (preview.duplicatesRemoved > 0 || preview.unavailableTracks > 0 || skippedPlaylistTrackCount > 0) && (
            <p className="text-center text-xs text-zinc-500">
              {(preview.totalSourceTracks + preview.duplicatesRemoved + preview.unavailableTracks).toLocaleString()} total songs
              {preview.unavailableTracks > 0 && ` · ${preview.unavailableTracks.toLocaleString()} unavailable`}
              {preview.duplicatesRemoved > 0 && !allowDuplicates && ` · ${preview.duplicatesRemoved.toLocaleString()} duplicate tracks removed`}
              {skippedPlaylistTrackCount > 0 && ` · ${skippedPlaylistTrackCount.toLocaleString()} in skipped name-matches`}
            </p>
          )}

          {/* Stats grid — 4 columns on large */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
            <div className="bg-[#7068FF] text-white rounded-2xl p-6 flex flex-col justify-between relative overflow-hidden shadow-lg">
              <div className="absolute -right-4 -bottom-4 opacity-20">
                <span className="material-icons-round text-6xl">queue_music</span>
              </div>
              <h3 className="text-xs font-bold uppercase tracking-wider mb-2 opacity-90">{allowDuplicates ? "Total Tracks" : "Unique Tracks"}</h3>
              <p className="text-4xl sm:text-5xl font-extrabold">{effectiveTotal.toLocaleString()}</p>
            </div>
            <div className="bg-primary text-black rounded-2xl p-6 flex flex-col justify-between relative overflow-hidden shadow-lg">
              <div className="absolute -right-2 -bottom-2 opacity-20">
                <span className="material-icons-round text-6xl">check_circle</span>
              </div>
              <h3 className="text-xs font-bold uppercase tracking-wider mb-2 opacity-90">Matched</h3>
              <p className="text-4xl sm:text-5xl font-extrabold">{progress.added.toLocaleString()}</p>
            </div>
            <div className="bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-2xl p-6 flex flex-col justify-between shadow-sm">
              <div className="flex justify-between items-start mb-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Skipped</h3>
                <span className="material-icons-round text-zinc-400 dark:text-zinc-600 text-sm">fast_forward</span>
              </div>
              <p className="text-4xl sm:text-5xl font-extrabold">{progress.skipped}</p>
            </div>
            <div className="bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-2xl p-6 flex flex-col justify-between shadow-sm">
              <div className="flex justify-between items-start mb-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Failed</h3>
                <span className="material-icons-round text-red-500 text-sm">error</span>
              </div>
              <p className="text-4xl sm:text-5xl font-extrabold text-red-500">{progress.failed}</p>
            </div>
          </div>

          {/* Detailed Report */}
          <div>
            <h2 className="text-xl font-bold mb-4">Detailed Report</h2>
            <div className="flex flex-col gap-4">
              {/* Match rate */}
              <div className="bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl p-4 sm:p-5 flex items-center gap-4 shadow-sm">
                <div className="w-10 h-10 rounded-lg bg-purple-100 dark:bg-[#7068FF]/20 flex items-center justify-center shrink-0">
                  <span className="material-icons-round text-purple-600 dark:text-[#7068FF] text-xl">playlist_add_check</span>
                </div>
                <div className="flex-grow">
                  <div className="flex justify-between items-end mb-2">
                    <span className="font-semibold text-sm">Match Rate</span>
                    <span className="text-primary font-bold text-sm">{matchRate}%</span>
                  </div>
                  <div className="w-full h-1.5 bg-zinc-200 dark:bg-zinc-700 rounded-full overflow-hidden">
                    <div className="h-full bg-primary rounded-full" style={{ width: `${matchRate}%` }} />
                  </div>
                </div>
              </div>

              {/* Unmatched report */}
              {hasUnmatched && (
                <div className="bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl shadow-sm overflow-hidden flex flex-col">
                  <div className="p-4 sm:p-5 flex justify-between items-center border-b border-zinc-100 dark:border-zinc-700">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded bg-yellow-100 dark:bg-yellow-500/20 flex items-center justify-center">
                        <span className="material-icons-round text-yellow-600 dark:text-yellow-400 text-sm">description</span>
                      </div>
                      <span className="font-semibold text-sm">Unmatched Report</span>
                    </div>
                    <button
                      className="flex items-center gap-2 text-xs font-semibold px-3 py-1.5 rounded-lg border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors active:scale-95"
                      onClick={() => void copyReport()}
                    >
                      <span className="material-icons-round text-[16px]">{copied ? "check" : "content_copy"}</span>
                      {copied ? "Copied!" : "Copy"}
                    </button>
                  </div>
                  <div className="bg-zinc-50 dark:bg-zinc-900 p-4 sm:p-6 flex-grow">
                    <pre className="text-xs sm:text-sm text-zinc-600 dark:text-zinc-400 font-mono h-48 overflow-y-auto whitespace-pre-wrap leading-relaxed">
                      <code>{unmatchedText}</code>
                    </pre>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex flex-col sm:flex-row gap-4 sm:items-center mt-2">
            {hasUnmatched && (
              <button
                className="flex-1 bg-primary text-black font-bold py-4 px-6 rounded-xl flex items-center justify-center gap-2 hover:brightness-110 transition-all active:scale-[0.98] shadow-lg shadow-primary/20"
                onClick={() => void copyReport()}
              >
                <span className="material-icons-round">{copied ? "check" : "content_copy"}</span>
                {copied ? "Copied!" : "Copy Report"}
              </button>
            )}
            <button
              className="flex-1 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-white font-bold py-4 px-6 rounded-xl flex items-center justify-center gap-2 hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors active:scale-[0.98] shadow-sm"
              onClick={() => router.push("/select-sources")}
            >
              <span className="material-icons-round">refresh</span>
              New Transfer
            </button>
          </div>
          <button
            className="w-full bg-zinc-100 dark:bg-zinc-800/50 text-zinc-600 dark:text-zinc-400 font-semibold py-4 px-6 rounded-xl hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors active:scale-[0.98]"
            onClick={() => router.push("/done")}
          >
            I&apos;m done
          </button>
        </div>

        {/* Progress bar */}
        <div className="fixed bottom-0 left-0 right-0 h-1 flex z-50">
          <div className="h-full bg-zinc-800 flex-1" />
          <div className="h-full bg-zinc-800 flex-1" />
          <div className="h-full bg-primary flex-1 shadow-[0_0_10px_rgba(34,197,94,0.5)]" />
        </div>
      </div>
    );
  }

  /* Fallback */
  return <div />;
}

/* ──────────────────────────── Export ──────────────────────────── */

export default function TransferPage(): ReactElement {
  return (
    <Suspense
      fallback={
        <div className="min-h-dvh bg-background-dark flex flex-col items-center justify-center">
          <div className="relative w-12 h-12 mb-4">
            <div className="absolute inset-0 border-4 border-dashed border-primary rounded-full animate-spin" />
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="material-icons-round text-primary">sync</span>
            </div>
          </div>
          <p className="text-zinc-500 text-sm font-bold">Loading...</p>
        </div>
      }
    >
      <TransferPageInner />
    </Suspense>
  );
}
