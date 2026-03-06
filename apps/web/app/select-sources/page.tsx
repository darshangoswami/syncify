"use client";

import type { SourcePlaylist } from "@spotify-xyz/shared";
import type { ReactElement } from "react";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface PlaylistItem extends SourcePlaylist {
  type: "liked" | "playlist";
}

const CACHE_KEY = "syncify:library";
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

interface CachedLibrary {
  playlists: PlaylistItem[];
  cachedAt: number;
}

function getCachedLibrary(): PlaylistItem[] | null {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const cached = JSON.parse(raw) as CachedLibrary;
    if (Date.now() - cached.cachedAt > CACHE_TTL_MS) {
      sessionStorage.removeItem(CACHE_KEY);
      return null;
    }
    return cached.playlists;
  } catch {
    return null;
  }
}

function setCachedLibrary(playlists: PlaylistItem[]): void {
  try {
    const entry: CachedLibrary = { playlists, cachedAt: Date.now() };
    sessionStorage.setItem(CACHE_KEY, JSON.stringify(entry));
  } catch { /* quota exceeded — ignore */ }
}

export default function SelectSourcesPage(): ReactElement {
  const router = useRouter();
  const [playlists, setPlaylists] = useState<PlaylistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [allowDuplicates, setAllowDuplicates] = useState(false);

  const fetchPlaylists = useCallback(async () => {
    const cached = getCachedLibrary();
    if (cached) {
      setPlaylists(cached);
      setSelectedIds(new Set(cached.map((p) => p.id)));
      setLoading(false);
      return;
    }

    try {
      const [playlistsRes, likedRes] = await Promise.all([
        fetch("/api/source/playlists"),
        fetch("/api/source/liked")
      ]);

      if (!playlistsRes.ok || !likedRes.ok) {
        setError("Failed to load your library. Make sure both providers are connected.");
        return;
      }

      const playlistsData = (await playlistsRes.json()) as { playlists: SourcePlaylist[] };
      const likedData = (await likedRes.json()) as { tracks: unknown[] };

      const items: PlaylistItem[] = [
        {
          id: "liked",
          name: "Liked Songs",
          trackCount: likedData.tracks.length,
          type: "liked"
        },
        ...playlistsData.playlists.map((p) => ({
          ...p,
          type: "playlist" as const
        }))
      ];

      setCachedLibrary(items);
      setPlaylists(items);
      setSelectedIds(new Set(items.map((p) => p.id)));
    } catch {
      setError("Failed to load your library.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchPlaylists();
  }, [fetchPlaylists]);

  const filtered = playlists.filter((p) =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const allSelected = filtered.length > 0 && filtered.every((p) => selectedIds.has(p.id));

  function toggleSelect(id: string): void {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function handleTransfer(): void {
    const playlistIds = [...selectedIds].filter((id) => id !== "liked");
    const includeLiked = selectedIds.has("liked");
    const params = new URLSearchParams();
    if (playlistIds.length > 0) params.set("playlists", playlistIds.join(","));
    if (includeLiked) params.set("liked", "true");
    const nameMap: Record<string, string> = {};
    for (const p of playlists.filter((pl) => selectedIds.has(pl.id))) {
      nameMap[p.id] = p.name;
    }
    params.set("names", JSON.stringify(nameMap));
    if (allowDuplicates) params.set("dupes", "true");
    router.push(`/transfer?${params.toString()}`);
  }

  function refreshLibrary(): void {
    sessionStorage.removeItem(CACHE_KEY);
    setPlaylists([]);
    setSelectedIds(new Set());
    setLoading(true);
    setError("");
    void fetchPlaylists();
  }

  function toggleSelectAll(): void {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map((p) => p.id)));
    }
  }

  if (loading) {
    return (
      <div className="min-h-dvh bg-background-dark flex flex-col items-center justify-center">
        <div className="relative w-12 h-12 mb-4">
          <div className="absolute inset-0 border-4 border-dashed border-primary rounded-full animate-spin" />
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="material-icons-round text-primary">sync</span>
          </div>
        </div>
        <p className="text-zinc-500 text-sm font-bold">Loading your library...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-dvh bg-background-dark flex flex-col items-center justify-center px-8 text-center">
        <span className="material-icons-round text-red-500 text-5xl mb-4">error_outline</span>
        <p className="text-white font-bold text-lg mb-2">Something went wrong</p>
        <p className="text-zinc-400 text-sm mb-6">{error}</p>
        <Link
          href="/connections"
          className="bg-zinc-800 text-white font-bold py-3 px-6 rounded-2xl transition-all active:scale-95"
        >
          Go Back
        </Link>
      </div>
    );
  }

  const likedItem = filtered.find((p) => p.type === "liked");
  const selectedCount = selectedIds.size;
  const totalTracks = playlists
    .filter((p) => selectedIds.has(p.id))
    .reduce((sum, p) => sum + p.trackCount, 0);

  return (
    <div className="min-h-dvh bg-background-dark flex flex-col antialiased overflow-x-hidden">
      {/* Header */}
      <header className="w-full max-w-6xl mx-auto px-6 py-8 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <Link
            href="/connections"
            aria-label="Go back"
            className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center hover:bg-zinc-700 transition-colors"
          >
            <span className="material-icons-round text-xl">arrow_back</span>
          </Link>
          <h1 className="text-3xl font-bold tracking-tight">Select Sources</h1>
        </div>
        <button
          aria-label="Refresh"
          className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center hover:bg-zinc-700 transition-colors"
          onClick={refreshLibrary}
        >
          <span className="material-icons-round text-xl">refresh</span>
        </button>
      </header>

      {/* Main */}
      <main className="flex-1 w-full max-w-6xl mx-auto px-6 pb-24 flex flex-col md:flex-row gap-8 relative">
        {/* Left — playlist list */}
        <div className="flex-1 flex flex-col gap-6">
          {/* Search */}
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <span className="material-icons-round text-zinc-500">search</span>
            </div>
            <input
              className="w-full pl-12 pr-4 py-4 rounded-full bg-zinc-900 border border-zinc-800 text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
              placeholder="Search your playlists..."
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          {/* Library header */}
          <div className="flex items-center justify-between pt-4">
            <h2 className="text-sm font-bold tracking-widest text-zinc-500 uppercase">
              Your Spotify Library
            </h2>
            <button
              className="flex items-center gap-2 cursor-pointer group"
              onClick={toggleSelectAll}
            >
              <span className="text-sm font-semibold text-primary">Select All</span>
              <div
                className={`w-6 h-6 rounded-full border-2 ${
                  allSelected
                    ? "border-primary bg-primary"
                    : "border-zinc-700 bg-transparent"
                } flex items-center justify-center transition-colors`}
              >
                {allSelected && (
                  <span className="material-icons-round text-white text-[18px] font-bold">check</span>
                )}
              </div>
            </button>
          </div>

          {/* Playlist grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Featured: Liked Songs */}
            {likedItem && (
              <button
                className={`rounded-2xl bg-gradient-to-br from-indigo-600 to-accent-blue p-4 flex items-center justify-between cursor-pointer hover:opacity-95 transition-opacity relative overflow-hidden border-2 ${
                  selectedIds.has("liked") ? "border-primary" : "border-transparent"
                }`}
                onClick={() => toggleSelect("liked")}
              >
                <div className="absolute right-0 bottom-0 opacity-20 pointer-events-none animate-float">
                  <svg fill="none" height="60" viewBox="0 0 100 100" width="60">
                    <path
                      d="M100 50C100 77.6142 77.6142 100 50 100C22.3858 100 0 77.6142 0 50C0 22.3858 22.3858 0 50 0C77.6142 0 100 22.3858 100 50ZM8.33333 50C8.33333 73.0119 26.9881 91.6667 50 91.6667C73.0119 91.6667 91.6667 73.0119 91.6667 50C91.6667 26.9881 73.0119 8.33333 50 8.33333C26.9881 8.33333 8.33333 26.9881 8.33333 50Z"
                      fill="white"
                    />
                  </svg>
                </div>
                <div className="flex items-center gap-4 z-10 w-full min-w-0 pr-4">
                  <div className="w-14 h-14 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center flex-shrink-0">
                    <span className="material-icons-round text-white text-3xl">favorite</span>
                  </div>
                  <div className="min-w-0 text-left">
                    <h3 className="text-white font-bold text-lg truncate">Liked Songs</h3>
                    <p className="text-white/80 text-sm truncate">
                      {likedItem.trackCount.toLocaleString()} tracks &bull; Saved
                    </p>
                  </div>
                </div>
                <div className="z-10 flex-shrink-0 flex items-center justify-center w-8 h-8 rounded-full bg-white/10">
                  <div
                    className={`w-6 h-6 rounded-full border-2 ${
                      selectedIds.has("liked")
                        ? "border-primary bg-primary"
                        : "border-white/30 bg-transparent"
                    } flex items-center justify-center`}
                  >
                    {selectedIds.has("liked") && (
                      <span className="material-icons-round text-white text-[18px] font-bold">check</span>
                    )}
                  </div>
                </div>
              </button>
            )}

            {/* Regular playlists */}
            {filtered
              .filter((p) => p.type === "playlist")
              .map((playlist) => {
                const isSelected = selectedIds.has(playlist.id);
                return (
                  <button
                    key={playlist.id}
                    className={`rounded-2xl bg-zinc-900 p-4 flex items-center justify-between cursor-pointer hover:border-primary/50 transition-colors border-2 ${
                      isSelected ? "border-primary" : "border-transparent"
                    }`}
                    onClick={() => toggleSelect(playlist.id)}
                  >
                    <div className="flex items-center gap-4 w-full min-w-0 pr-4">
                      <div className="w-14 h-14 rounded-xl bg-background-dark border border-zinc-800 flex items-center justify-center flex-shrink-0">
                        <span className="material-icons-round text-zinc-500">music_note</span>
                      </div>
                      <div className="min-w-0 text-left">
                        <h3 className="font-bold text-lg leading-tight mb-1 truncate">{playlist.name}</h3>
                        <p className="text-zinc-500 text-sm truncate">{playlist.trackCount} tracks</p>
                      </div>
                    </div>
                    <div className="flex-shrink-0 ml-4">
                      <div
                        className={`w-6 h-6 rounded-full border-2 ${
                          isSelected
                            ? "border-primary bg-primary"
                            : "border-zinc-700 bg-transparent"
                        } flex items-center justify-center transition-colors`}
                      >
                        {isSelected && (
                          <span className="material-icons-round text-white text-[18px] font-bold">check</span>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
          </div>
        </div>

        {/* Right — Transfer Summary sidebar */}
        <div className="md:w-80 flex-shrink-0 md:sticky md:top-8 h-fit relative">
          <div className="rounded-2xl bg-zinc-900 p-6 border border-zinc-800">
            <h3 className="font-bold text-xl mb-4">Transfer Summary</h3>
            <div className="flex justify-between items-center mb-2">
              <span className="text-zinc-400">Selected Playlists</span>
              <span className="font-bold">{selectedCount}</span>
            </div>
            <div className="flex justify-between items-center mb-6">
              <span className="text-zinc-400">Total Tracks</span>
              <span className="font-bold">{totalTracks.toLocaleString()}</span>
            </div>
            <div className="space-y-4">
              <label className="flex items-center gap-3 cursor-pointer group">
                <button
                  type="button"
                  className={`w-6 h-6 rounded-full border-2 ${
                    allowDuplicates ? "border-primary bg-primary" : "border-zinc-700 bg-transparent"
                  } flex items-center justify-center transition-colors flex-shrink-0`}
                  onClick={() => setAllowDuplicates((v) => !v)}
                >
                  {allowDuplicates && (
                    <span className="material-icons-round text-white text-[16px] font-bold">check</span>
                  )}
                </button>
                <span className="text-sm text-zinc-400 group-hover:text-white transition-colors">
                  Allow duplicate tracks
                </span>
              </label>
            </div>
            <div className="mt-8 pt-6 border-t border-zinc-800">
              <button
                className="w-full bg-primary hover:bg-primary/90 text-black font-bold py-4 px-6 rounded-full flex items-center justify-center gap-2 transition-all transform hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-primary/20 disabled:opacity-50 disabled:scale-100"
                disabled={selectedIds.size === 0}
                onClick={handleTransfer}
              >
                <span>Transfer to TIDAL</span>
                <span className="material-icons-round">arrow_forward</span>
              </button>
              <p className="text-center text-xs text-zinc-500 mt-4">
                You can review the transfer on the next screen.
              </p>
            </div>
          </div>

          {/* Decorative SVGs */}
          <div className="absolute -z-10 -bottom-12 -left-12 opacity-30 pointer-events-none">
            <svg className="animate-float" fill="none" height="100" viewBox="0 0 100 100" width="100" style={{ animationDelay: "-2s" }}>
              <path d="M50 0L93.3013 25V75L50 100L6.69873 75V25L50 0Z" stroke="#5b66f6" strokeWidth="4" />
              <path d="M50 20L75.9808 35V65L50 80L24.0192 65V35L50 20Z" stroke="#5b66f6" strokeWidth="4" />
            </svg>
          </div>
          <div className="absolute -z-10 -top-12 -right-12 opacity-20 pointer-events-none">
            <svg className="animate-float" fill="none" height="120" viewBox="0 0 100 100" width="120">
              <path
                d="M50 100C77.6142 100 100 77.6142 100 50C100 22.3858 77.6142 0 50 0C22.3858 0 0 22.3858 0 50C0 77.6142 22.3858 100 50 100Z"
                stroke="#22c55e"
                strokeDasharray="8 8"
                strokeWidth="2"
              />
            </svg>
          </div>
        </div>
      </main>

      {/* Progress bar */}
      <div className="fixed bottom-0 left-0 right-0 h-1 flex z-50">
        <div className="h-full bg-primary flex-1 shadow-[0_0_10px_rgba(34,197,94,0.5)]" />
        <div className="h-full bg-zinc-800 flex-1" />
        <div className="h-full bg-zinc-800 flex-1" />
      </div>
    </div>
  );
}
