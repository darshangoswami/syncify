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
      <div className="fixed inset-0 flex justify-center">
        <div className="relative w-full max-w-100 h-full bg-background-dark flex flex-col items-center justify-center">
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
      </div>
    );
  }

  /* ──────────────────────────── Error ─────────────────────────── */
  if (error && phase !== "progress" && phase !== "results") {
    return (
      <div className="fixed inset-0 flex justify-center">
        <div className="relative w-full max-w-100 h-full bg-background-dark flex flex-col items-center justify-center px-8 text-center">
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
      <div className="fixed inset-0 flex justify-center">
        <div className="relative w-full max-w-100 h-full bg-background-dark overflow-hidden flex flex-col">
          {/* Header */}
          <header className="px-6 py-4 flex items-center justify-between">
            <Link
              href="/select-sources"
              className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center"
            >
              <span className="material-icons-round">arrow_back</span>
            </Link>
            <h1 className="text-lg font-bold">Transfer Preview</h1>
            <div className="w-10" />
          </header>

          {/* Scrollable content */}
          <div className="flex-1 px-6 pb-32 overflow-y-auto space-y-6">
            {/* Hero card */}
            <section className="relative bg-primary p-6 rounded-[2.5rem] text-black overflow-hidden shadow-lg">
              <div className="absolute top-0 right-0 opacity-20 pointer-events-none">
                <svg fill="none" height="120" viewBox="0 0 100 100" width="120">
                  <path d="M10,50 Q25,25 50,50 T90,50" fill="none" stroke="currentColor" strokeWidth="4" />
                  <circle cx="80" cy="20" fill="currentColor" r="10" />
                </svg>
              </div>
              <div className="relative z-10 flex flex-col items-center py-4">
                <span className="text-xs font-bold uppercase tracking-widest opacity-70 mb-2">Ready to move</span>
                <div className="flex items-baseline gap-1">
                  <span className="text-6xl font-black">{effectiveMatched.toLocaleString()}</span>
                  <span className="text-xl font-bold">Songs</span>
                </div>
                <div className="w-full h-3 bg-black/10 rounded-full mt-8 relative overflow-hidden">
                  <div className="absolute top-0 left-0 h-full bg-black/40" style={{ width: `${matchedPercent}%` }} />
                </div>
                <div className="flex justify-between w-full mt-3 text-sm font-bold opacity-80">
                  <div className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-black/60" />
                    {effectiveMatched} Matched
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-white/60" />
                    {effectiveTotal - effectiveMatched} Unmatched
                  </div>
                </div>
              </div>
            </section>

            {/* Track accounting note */}
            {(preview.duplicatesRemoved > 0 || preview.unavailableTracks > 0 || allowDuplicates || skippedPlaylistTrackCount > 0) && (
              <p className="text-center text-xs text-zinc-500 -mt-3">
                {(preview.totalSourceTracks + preview.duplicatesRemoved + preview.unavailableTracks).toLocaleString()} total
                {preview.unavailableTracks > 0 && ` · ${preview.unavailableTracks.toLocaleString()} unavailable`}
                {preview.duplicatesRemoved > 0 && !allowDuplicates && ` · ${preview.duplicatesRemoved.toLocaleString()} duplicates removed`}
                {allowDuplicates && " · duplicates included"}
                {skippedPlaylistTrackCount > 0 && ` · ${skippedPlaylistTrackCount.toLocaleString()} in skipped name-matches`}
              </p>
            )}

            {/* Sync source indicator */}
            <section className="flex items-center justify-between p-4 bg-zinc-900 rounded-2xl border border-zinc-800">
              <div className="flex items-center gap-3">
                <div className="flex -space-x-2">
                  <div className="w-10 h-10 rounded-full bg-[#1DB954] flex items-center justify-center ring-4 ring-zinc-900">
                    <span className="material-icons-round text-white text-lg">music_note</span>
                  </div>
                  <div className="w-10 h-10 rounded-full bg-black flex items-center justify-center ring-4 ring-zinc-900 border border-zinc-700">
                    <span className="material-icons-round text-white text-lg">waves</span>
                  </div>
                </div>
                <div>
                  <p className="text-xs text-zinc-400 font-semibold uppercase tracking-tight">Syncing from</p>
                  <p className="text-sm font-bold">Spotify to TIDAL</p>
                </div>
              </div>
              <span className="material-icons-round text-primary">sync_alt</span>
            </section>

            {/* Playlists breakdown */}
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold">Playlists breakdown</h2>
              <span className="text-sm text-zinc-500 font-semibold">{effectivePlaylists.length} total</span>
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
                    className={`p-4 bg-zinc-900 rounded-3xl flex items-center gap-4 group hover:ring-2 ring-primary transition-all ${isExcluded ? "opacity-40" : ""}`}
                  >
                    <div className={`w-14 h-14 ${color} rounded-2xl flex items-center justify-center shadow-lg transform group-hover:rotate-3 transition-transform`}>
                      <span className="material-icons-round text-white text-3xl">{icon}</span>
                    </div>
                    <div className="flex-1">
                      <h3 className="font-bold text-base">{playlist.playlistName}</h3>
                      <p className="text-sm text-zinc-500">{playlist.matchedCount} songs matched</p>
                    </div>
                    <div className="flex flex-col items-end">
                      {isExcluded ? (
                        <>
                          <span className="text-amber-500 font-bold">Skipped</span>
                          <span className="text-[10px] uppercase font-bold text-zinc-400">Already on TIDAL</span>
                        </>
                      ) : playlist.unmatchedCount > 0 ? (
                        <>
                          <span className="text-yellow-500 font-bold">{playlist.unmatchedCount} unmatched</span>
                          <span className="text-[10px] uppercase font-bold text-zinc-400">Review needed</span>
                        </>
                      ) : (
                        <>
                          <span className="text-primary font-bold">{pctMatch}%</span>
                          <span className="text-[10px] uppercase font-bold text-zinc-400">
                            {pctMatch === 100 ? "All found" : "Perfect Match"}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Already on TIDAL */}
            {existingPlaylists.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-bold">Already on TIDAL</h2>
                  <span className="text-sm text-zinc-500 font-semibold">{existingPlaylists.length} found</span>
                </div>
                <div className="bg-amber-500/10 border border-amber-500/20 p-4 rounded-2xl space-y-3">
                  {existingPlaylists.map((ep) => (
                    <div key={ep.sourcePlaylistId} className="flex items-center gap-3">
                      <span className="material-icons-round text-amber-500 text-lg">playlist_play</span>
                      <span className="text-sm text-amber-300 font-medium">{ep.sourcePlaylistName}</span>
                    </div>
                  ))}
                </div>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={allowDuplicatePlaylists}
                    onChange={(e) => setAllowDuplicatePlaylists(e.target.checked)}
                    className="w-5 h-5 rounded border-zinc-600 bg-zinc-800 text-primary accent-primary"
                  />
                  <span className="text-sm text-zinc-300 font-medium">Create playlists even if names already exist</span>
                </label>
                <p className="text-xs text-zinc-500">
                  Name matches are heuristic only. Turn this off only if you want to skip same-name playlists.
                </p>
              </div>
            )}

            {/* Warning for unmatched */}
            {effectiveUnmatched > 0 && (
              <div className="bg-yellow-500/10 border border-yellow-500/20 p-4 rounded-2xl flex gap-3 items-start">
                <span className="material-icons-round text-yellow-500 mt-0.5">warning</span>
                <p className="text-sm text-yellow-400 leading-relaxed font-medium">
                  {effectiveUnmatched} songs couldn&apos;t be automatically matched. You can review them after the transfer is complete.
                </p>
              </div>
            )}
          </div>

          {/* Bottom CTA */}
          <div className="absolute bottom-0 left-0 right-0 p-6 pt-10 bg-gradient-to-t from-background-dark via-background-dark/90 to-transparent">
            <button
              className="w-full bg-primary text-black py-5 rounded-[2rem] font-black text-lg shadow-[0_10px_30px_rgba(34,197,94,0.3)] transition-all active:scale-[0.98] flex items-center justify-center gap-2"
              onClick={() => void startTransfer()}
            >
              <span>START TRANSFER</span>
              <span className="material-icons-round">arrow_forward</span>
            </button>
            <div className="mt-4 flex justify-center gap-2">
              <div className="w-12 h-1.5 rounded-full bg-zinc-800" />
              <div className="w-12 h-1.5 rounded-full bg-primary" />
              <div className="w-12 h-1.5 rounded-full bg-zinc-800" />
            </div>
          </div>

          {/* Decorative */}
          <div className="absolute top-[20%] -left-6 pointer-events-none opacity-20 animate-pulse">
            <svg height="60" viewBox="0 0 100 100" width="60">
              <path d="M50 10 L60 40 L90 50 L60 60 L50 90 L40 60 L10 50 L40 40 Z" fill="#22c55e" />
            </svg>
          </div>
          <div className="absolute bottom-[20%] -right-6 pointer-events-none opacity-20 animate-bounce">
            <svg height="80" viewBox="0 0 100 100" width="80">
              <circle cx="50" cy="50" fill="none" r="30" stroke="#7C3AED" strokeDasharray="10 5" strokeWidth="4" />
            </svg>
          </div>
        </div>
      </div>
    );
  }

  /* ══════════════════════════════════════════════════════════════ */
  /*                    PHASE 2: PROGRESS                         */
  /* ══════════════════════════════════════════════════════════════ */
  if (phase === "progress") {
    return (
      <div className="fixed inset-0 flex justify-center">
        <div className="relative w-full max-w-100 h-full bg-black overflow-y-auto flex flex-col">
          {/* Header */}
          <header className="px-6 pt-6 pb-4 flex items-center justify-between">
            <div className="w-10 h-10 rounded-full bg-zinc-900 flex items-center justify-center opacity-50">
              <span className="material-icons-round">arrow_back</span>
            </div>
            <h1 className="text-lg font-bold">Transfer</h1>
            <div className="w-10" />
          </header>

          {/* Info */}
          <div className="px-6 space-y-1 mb-6">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-extrabold uppercase tracking-wider">
                Live Transfer
              </span>
            </div>
            <h2 className="text-2xl font-extrabold leading-tight">{progress.currentPlaylistName || "Starting..."}</h2>
            <p className="text-zinc-400 font-medium">
              Processing ({progress.processedTracks}/{progress.totalTracks})
            </p>
          </div>

          {/* Circular progress */}
          <div className="relative flex-1 flex flex-col items-center justify-center">
            {/* Floating stickers */}
            <div className="absolute top-0 right-6 animate-float" style={{ animationDelay: "0.5s" }}>
              <div className="w-12 h-12 bg-[#7C5DFF] rounded-xl rotate-12 flex items-center justify-center shadow-lg border-2 border-white">
                <span className="material-icons-round text-white">music_note</span>
              </div>
            </div>
            <div className="absolute bottom-10 left-6 animate-float">
              <div className="w-14 h-14 bg-yellow-400 rounded-full -rotate-6 flex items-center justify-center shadow-lg border-2 border-white">
                <span className="material-icons-round text-black">auto_awesome</span>
              </div>
            </div>

            {/* Progress ring */}
            <div
              className="relative w-64 h-64 rounded-full flex items-center justify-center shadow-[0_0_50px_rgba(34,197,94,0.15)]"
              style={{
                background: `radial-gradient(closest-side, #161616 79%, transparent 80% 100%), conic-gradient(#22c55e ${percentComplete}%, #262626 0)`
              }}
            >
              <div className="w-[85%] h-[85%] bg-zinc-900 rounded-full flex flex-col items-center justify-center text-center p-8">
                <div className="relative mb-2">
                  <svg className="text-primary" height="60" viewBox="0 0 100 100" width="60">
                    <path className="doodle-path" d="M20,50 Q35,20 50,50 T80,50" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="4" />
                    <circle cx="50" cy="50" fill="none" r="40" stroke="currentColor" strokeDasharray="4 4" strokeWidth="1" />
                  </svg>
                  <span className="material-icons-round absolute inset-0 flex items-center justify-center text-3xl">sync</span>
                </div>
                <span className="text-4xl font-black tracking-tighter">{percentComplete}%</span>
                <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mt-1">
                  {avgChunkTime > 0 ? `Est. ${estimatedMinutes} min` : "Calculating..."}
                </span>
              </div>
            </div>

            {/* Decorative wave */}
            <div className="mt-12 w-full flex justify-center opacity-40">
              <svg className="text-primary" height="30" viewBox="0 0 200 30" width="200">
                <path d="M0 15 Q 12.5 5, 25 15 T 50 15 T 75 15 T 100 15 T 125 15 T 150 15 T 175 15 T 200 15" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="3" />
              </svg>
            </div>
          </div>

          {/* Now playing card */}
          <div className="px-6 mb-4">
            <div className="bg-zinc-900/50 border border-zinc-800 rounded-3xl p-5 flex items-center gap-4">
              <div className="w-12 h-12 bg-zinc-800 rounded-xl overflow-hidden flex-shrink-0">
                <div className="w-full h-full bg-gradient-to-br from-[#4A7CFF] to-[#7C5DFF] opacity-80 flex items-center justify-center">
                  <span className="material-icons-round text-white">play_arrow</span>
                </div>
              </div>
              <div className="flex-1 overflow-hidden">
                <p className="text-xs font-bold text-primary mb-0.5">Moving now</p>
                <p className="font-bold truncate">
                  {progress.currentTrackTitle
                    ? `${progress.currentTrackTitle} — ${progress.currentTrackArtist}`
                    : "Preparing..."}
                </p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-[10px] px-1.5 py-0.5 bg-green-500/10 text-green-500 rounded font-bold">SPOTIFY</span>
                  <span className="material-icons-round text-xs text-zinc-600">arrow_forward</span>
                  <span className="text-[10px] px-1.5 py-0.5 bg-black text-white rounded font-bold border border-zinc-700">TIDAL</span>
                </div>
              </div>
            </div>
          </div>

          {/* Stop button */}
          <div className="px-6 pb-8">
            <button
              className="w-full py-5 rounded-[22px] bg-zinc-800 text-white font-bold transition-all flex items-center justify-center gap-2 active:scale-[0.98]"
              onClick={stopTransfer}
            >
              <span className="material-icons-round text-red-500">stop_circle</span>
              Stop Transfer
            </button>
            <p className="text-center text-[11px] text-zinc-500 mt-4 px-6 leading-relaxed">
              Keep your screen on and don&apos;t close the app during the transfer.
            </p>
          </div>
        </div>
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
      <div className="fixed inset-0 flex justify-center">
        <div className="relative w-full max-w-100 h-full bg-[#121212] overflow-hidden flex flex-col">
          {/* Header */}
          <div className="px-6 pt-8 pb-4 relative overflow-hidden">
            <div className="flex justify-between items-start mb-6">
              <button
                className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center"
                onClick={() => router.push("/select-sources")}
              >
                <span className="material-icons-round">arrow_back</span>
              </button>
            </div>
            <h1 className="text-4xl font-extrabold leading-tight mb-2">
              Transfer <br />
              <span className="text-primary">{progress.cancelled ? "Stopped" : "Complete"}</span>
            </h1>
            <p className="text-zinc-400 text-sm max-w-[80%] mt-4">
              {progress.cancelled
                ? "Transfer was stopped. Partial results are shown below."
                : "Your Spotify library has been successfully moved to TIDAL."}
            </p>

            {/* Decorative SVG */}
            <div className="absolute top-20 right-4 animate-float opacity-80">
              <svg fill="none" height="60" viewBox="0 0 60 60" width="60">
                <path className="text-[#5865F2]" d="M10 30C10 30 15 10 30 10C45 10 50 30 50 30C50 30 45 50 30 50C15 50 10 30 10 30Z" stroke="currentColor" strokeWidth="2" />
                <circle className="text-primary" cx="30" cy="30" fill="currentColor" r="10" />
                <path className="text-zinc-700" d="M5 5L15 15M55 5L45 15M5 55L15 45M55 55L45 45" stroke="currentColor" strokeWidth="2" />
              </svg>
            </div>
          </div>

          {/* Scrollable content */}
          <div className="flex-1 overflow-y-auto px-6 pb-48 space-y-4">
            {/* Stats grid */}
            {preview && (preview.duplicatesRemoved > 0 || preview.unavailableTracks > 0 || skippedPlaylistTrackCount > 0) && (
              <p className="text-center text-xs text-zinc-500">
                {(preview.totalSourceTracks + preview.duplicatesRemoved + preview.unavailableTracks).toLocaleString()} total songs
                {preview.unavailableTracks > 0 && ` · ${preview.unavailableTracks.toLocaleString()} unavailable`}
                {preview.duplicatesRemoved > 0 && !allowDuplicates && ` · ${preview.duplicatesRemoved.toLocaleString()} duplicate tracks removed`}
                {skippedPlaylistTrackCount > 0 && ` · ${skippedPlaylistTrackCount.toLocaleString()} in skipped name-matches`}
              </p>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-[#5865F2] p-5 rounded-3xl text-white relative overflow-hidden">
                <span className="text-xs font-bold uppercase tracking-widest opacity-80">{allowDuplicates ? "Total Tracks" : "Unique Tracks"}</span>
                <div className="text-4xl font-black mt-1">{effectiveTotal.toLocaleString()}</div>
                <span className="material-icons-round absolute -bottom-2 -right-2 text-6xl opacity-20 rotate-12">library_music</span>
              </div>
              <div className="bg-primary p-5 rounded-3xl text-black relative overflow-hidden">
                <span className="text-xs font-bold uppercase tracking-widest opacity-70">Matched</span>
                <div className="text-4xl font-black mt-1">{progress.added.toLocaleString()}</div>
                <span className="material-icons-round absolute -bottom-2 -right-2 text-6xl opacity-20 rotate-12">verified</span>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-zinc-800 p-5 rounded-3xl relative overflow-hidden">
                <span className="text-xs font-bold uppercase tracking-widest text-zinc-400">Skipped</span>
                <div className="text-3xl font-bold mt-1">{progress.skipped}</div>
                <span className="material-icons-round absolute top-4 right-4 text-zinc-600">fast_forward</span>
              </div>
              <div className="bg-zinc-800 p-5 rounded-3xl relative overflow-hidden border-2 border-transparent hover:border-red-400/30 transition-colors">
                <span className="text-xs font-bold uppercase tracking-widest text-zinc-400">Failed</span>
                <div className="text-3xl font-bold mt-1 text-red-500">{progress.failed}</div>
                <span className="material-icons-round absolute top-4 right-4 text-red-500/50">error</span>
              </div>
            </div>

            {/* Detailed report */}
            <div className="mt-6">
              <h3 className="font-bold text-lg mb-4">Detailed Report</h3>
              <div className="space-y-3">
                {/* Match rate */}
                <div className="flex items-center gap-4 bg-zinc-900/50 p-3 rounded-2xl border border-zinc-800">
                  <div className="w-10 h-10 bg-[#B794F4] rounded-xl flex items-center justify-center text-white">
                    <span className="material-icons-round">playlist_add_check</span>
                  </div>
                  <div className="flex-1">
                    <div className="text-sm font-bold">Match Rate</div>
                    <div className="h-1.5 w-full bg-zinc-700 rounded-full mt-1 overflow-hidden">
                      <div className="bg-primary h-full rounded-full" style={{ width: `${matchRate}%` }} />
                    </div>
                  </div>
                  <div className="text-xs font-bold text-primary">{matchRate}%</div>
                </div>

                {/* Unmatched report text box */}
                {hasUnmatched && (
                  <div className="bg-zinc-900/50 p-4 rounded-2xl border border-zinc-800">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-[#F6E05E] rounded-xl flex items-center justify-center text-black">
                          <span className="material-icons-round">description</span>
                        </div>
                        <div className="text-sm font-bold">Unmatched Report</div>
                      </div>
                      <button
                        className="bg-zinc-800 px-3 py-1.5 rounded-lg text-xs font-bold border border-zinc-700 shadow-sm active:scale-95 transition-transform flex items-center gap-1"
                        onClick={() => void copyReport()}
                      >
                        <span className="material-icons-round text-sm">{copied ? "check" : "content_copy"}</span>
                        {copied ? "Copied!" : "Copy"}
                      </button>
                    </div>
                    <textarea
                      className="w-full h-32 bg-zinc-800 border border-zinc-700 rounded-xl p-3 text-xs text-zinc-300 font-mono resize-none outline-none focus:ring-2 focus:ring-primary"
                      readOnly
                      value={unmatchedText}
                    />
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Bottom actions */}
          <div className="absolute bottom-0 left-0 right-0 p-6 pt-10 bg-gradient-to-t from-[#121212] via-[#121212]/90 to-transparent space-y-3">
            <div className={`grid ${hasUnmatched ? "grid-cols-2" : "grid-cols-1"} gap-3`}>
              {hasUnmatched && (
                <button
                  className="bg-primary text-black font-bold py-4 rounded-full flex items-center justify-center gap-2 active:scale-[0.98] transition-all text-sm"
                  onClick={() => void copyReport()}
                >
                  <span className="material-icons-round text-lg">{copied ? "check" : "content_copy"}</span>
                  {copied ? "Copied!" : "Copy Report"}
                </button>
              )}
              <button
                className="bg-transparent text-white border-2 border-zinc-800 font-bold py-4 rounded-full flex items-center justify-center gap-2 hover:bg-zinc-900 active:scale-[0.98] transition-all text-sm"
                onClick={() => router.push("/select-sources")}
              >
                <span className="material-icons-round text-lg">refresh</span>
                New Transfer
              </button>
            </div>
            <button
              className="w-full bg-zinc-900 text-zinc-300 font-bold py-4 rounded-full flex items-center justify-center gap-2 hover:bg-zinc-800 hover:text-white active:scale-[0.98] transition-all"
              onClick={() => router.push("/done")}
            >
              I&apos;m done
            </button>
          </div>

          {/* Decorative wave */}
          <div className="absolute -bottom-6 -left-10 opacity-20 pointer-events-none">
            <svg fill="none" height="100" viewBox="0 0 200 100" width="200">
              <path className="text-primary" d="M10 80C30 40 70 90 110 50C150 10 190 60 190 60" stroke="currentColor" strokeLinecap="round" strokeWidth="12" />
            </svg>
          </div>
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
        <div className="fixed inset-0 flex justify-center">
          <div className="relative w-full max-w-100 h-full bg-background-dark flex flex-col items-center justify-center">
            <div className="relative w-12 h-12 mb-4">
              <div className="absolute inset-0 border-4 border-dashed border-primary rounded-full animate-spin" />
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="material-icons-round text-primary">sync</span>
              </div>
            </div>
            <p className="text-zinc-500 text-sm font-bold">Loading...</p>
          </div>
        </div>
      }
    >
      <TransferPageInner />
    </Suspense>
  );
}
