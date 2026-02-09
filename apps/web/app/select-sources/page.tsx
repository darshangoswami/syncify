"use client";

import type { SourcePlaylist } from "@spotify-xyz/shared";
import type { ReactElement } from "react";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

interface PlaylistItem extends SourcePlaylist {
  type: "liked" | "playlist";
}

export default function SelectSourcesPage(): ReactElement {
  const [playlists, setPlaylists] = useState<PlaylistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const fetchPlaylists = useCallback(async () => {
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

  function toggleSelectAll(): void {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map((p) => p.id)));
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="relative w-[375px] min-h-[812px] bg-background-dark flex flex-col items-center justify-center">
          <div className="relative w-12 h-12 mb-4">
            <div className="absolute inset-0 border-4 border-dashed border-primary rounded-full animate-spin" />
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="material-icons-round text-primary">sync</span>
            </div>
          </div>
          <p className="text-zinc-500 text-sm font-bold">Loading your library...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="relative w-[375px] min-h-[812px] bg-background-dark flex flex-col items-center justify-center px-8 text-center">
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
      </div>
    );
  }

  const likedItem = filtered.find((p) => p.type === "liked");

  return (
    <div className="flex justify-center items-center min-h-screen">
      <div className="relative w-[375px] min-h-[812px] bg-background-dark overflow-hidden flex flex-col">
        {/* Header */}
        <header className="px-6 py-4 flex items-center justify-between">
          <Link
            href="/connections"
            className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center"
          >
            <span className="material-icons-round">arrow_back</span>
          </Link>
          <h1 className="text-lg font-bold">Select Sources</h1>
          <div className="w-10" />
        </header>

        {/* Search + Controls */}
        <div className="px-6 mb-4">
          <div className="relative">
            <span className="material-icons-round absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
              search
            </span>
            <input
              className="w-full bg-zinc-900 border-none rounded-2xl py-3 pl-12 pr-4 text-sm focus:ring-2 focus:ring-primary outline-none"
              placeholder="Search your playlists..."
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="flex items-center justify-between mt-6">
            <span className="text-xs font-bold uppercase tracking-widest text-zinc-500">
              Your Spotify Library
            </span>
            <button
              className="flex items-center gap-2 text-primary font-bold text-sm"
              onClick={toggleSelectAll}
            >
              Select All
              <div
                className={`w-5 h-5 rounded-md border-2 ${
                  allSelected
                    ? "border-primary bg-primary"
                    : "border-zinc-600 bg-transparent"
                } flex items-center justify-center`}
              >
                {allSelected && (
                  <span className="material-icons-round text-white text-[16px] font-bold">
                    check
                  </span>
                )}
              </div>
            </button>
          </div>
        </div>

        {/* Playlist List */}
        <div className="flex-1 overflow-y-auto px-6 pb-24 custom-scrollbar space-y-4">
          {/* Featured: Liked Songs */}
          {likedItem && (
            <button
              className="w-full text-left relative overflow-hidden p-5 bg-gradient-to-br from-indigo-600 to-accent-blue rounded-3xl transition-transform active:scale-95 cursor-pointer"
              onClick={() => toggleSelect("liked")}
            >
              <div className="relative z-10 flex items-center gap-4">
                <div className="w-14 h-14 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center">
                  <span className="material-icons-round text-white text-3xl">favorite</span>
                </div>
                <div className="flex-1">
                  <h3 className="text-white font-bold text-lg">Liked Songs</h3>
                  <p className="text-indigo-100 text-sm">
                    {likedItem.trackCount.toLocaleString()} tracks &bull; Saved
                  </p>
                </div>
                <div
                  className={`w-6 h-6 rounded-full border-2 ${
                    selectedIds.has("liked")
                      ? "border-white/50 bg-white"
                      : "border-white/30 bg-transparent"
                  } flex items-center justify-center`}
                >
                  {selectedIds.has("liked") && (
                    <span className="material-icons-round text-indigo-600 text-[18px] font-bold">
                      check
                    </span>
                  )}
                </div>
              </div>
              <div className="absolute -right-2 -bottom-2 opacity-30 animate-float">
                <svg height="80" viewBox="0 0 100 100" width="80">
                  <path
                    d="M20,50 Q30,20 50,50 T80,50"
                    fill="none"
                    stroke="white"
                    strokeLinecap="round"
                    strokeWidth="4"
                  />
                  <circle cx="30" cy="30" fill="white" r="5" />
                  <circle cx="70" cy="70" fill="white" r="5" />
                </svg>
              </div>
            </button>
          )}

          {/* Regular playlists */}
          <div className="space-y-3">
            {filtered
              .filter((p) => p.type === "playlist")
              .map((playlist) => {
                const isSelected = selectedIds.has(playlist.id);
                return (
                  <button
                    key={playlist.id}
                    className={`w-full text-left flex items-center gap-4 p-4 bg-zinc-900/50 rounded-2xl border-2 ${
                      isSelected ? "border-primary" : "border-transparent hover:border-primary/30"
                    } transition-all cursor-pointer`}
                    onClick={() => toggleSelect(playlist.id)}
                  >
                    <div className="w-12 h-12 rounded-xl bg-zinc-800 flex items-center justify-center">
                      <span className="material-icons-round text-slate-400">music_note</span>
                    </div>
                    <div className="flex-1">
                      <h4 className="font-bold text-sm">{playlist.name}</h4>
                      <p className="text-xs text-zinc-400">{playlist.trackCount} tracks</p>
                    </div>
                    <div
                      className={`w-6 h-6 rounded-full ${
                        isSelected
                          ? "bg-primary"
                          : "border-2 border-zinc-700 bg-transparent"
                      } flex items-center justify-center`}
                    >
                      {isSelected && (
                        <span className="material-icons-round text-white text-[18px] font-bold">
                          check
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
          </div>
        </div>

        {/* Bottom CTA */}
        <div className="absolute bottom-0 left-0 right-0 p-6 pt-10 bg-gradient-to-t from-background-dark via-background-dark/90 to-transparent">
          <button className="w-full bg-primary text-black font-extrabold text-lg py-5 rounded-[24px] shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-3">
            Transfer to TIDAL
            <span className="material-icons-round font-bold">arrow_forward</span>
          </button>
          <div className="mt-4 flex justify-center gap-2">
            <div className="w-12 h-1.5 rounded-full bg-primary" />
            <div className="w-12 h-1.5 rounded-full bg-zinc-800" />
            <div className="w-12 h-1.5 rounded-full bg-zinc-800" />
          </div>
        </div>

        {/* Decorative SVGs */}
        <div className="absolute top-24 -right-8 pointer-events-none opacity-30">
          <svg className="animate-float" height="100" viewBox="0 0 100 100" width="100">
            <path
              d="M10,40 C10,10 40,10 40,40 S70,70 70,40"
              fill="none"
              stroke="#22c55e"
              strokeLinecap="round"
              strokeWidth="4"
            />
            <circle cx="20" cy="20" fill="#22c55e" r="4" />
          </svg>
        </div>
        <div className="absolute bottom-40 -left-6 pointer-events-none opacity-30">
          <svg
            className="animate-float"
            height="80"
            style={{ animationDelay: "-2s" }}
            viewBox="0 0 100 100"
            width="80"
          >
            <path
              d="M50,20 L80,50 L50,80 L20,50 Z"
              fill="none"
              stroke="#5b66f6"
              strokeLinecap="round"
              strokeWidth="4"
            />
            <path d="M50,40 L60,50 L50,60 L40,50 Z" fill="#5b66f6" />
          </svg>
        </div>
      </div>
    </div>
  );
}
