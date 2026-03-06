"use client";

import type { ReactElement } from "react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { LIBRARY_CACHE_KEY } from "@/lib/constants";

type DeleteState = "idle" | "deleting" | "done";

export default function DonePage(): ReactElement {
  const router = useRouter();
  const [deleteState, setDeleteState] = useState<DeleteState>("idle");

  async function handleDelete(): Promise<void> {
    if (deleteState !== "idle") return;
    setDeleteState("deleting");

    try {
      sessionStorage.removeItem(LIBRARY_CACHE_KEY);
    } catch { /* ignore */ }

    try {
      const [res] = await Promise.all([
        fetch("/api/auth/delete", { method: "POST" }),
        new Promise((r) => setTimeout(r, 3000)),
      ]);
      if (res.ok) {
        setDeleteState("done");
      } else {
        setDeleteState("idle");
      }
    } catch {
      setDeleteState("idle");
    }
  }

  return (
    <div className="min-h-dvh bg-zinc-50 dark:bg-background-dark text-zinc-900 dark:text-white flex flex-col items-center justify-center relative overflow-hidden antialiased">
      {/* Floating decorative icons */}
      <div className="absolute top-32 left-32 md:left-64 animate-float opacity-80">
        <span className="material-icons-round text-primary text-4xl">star</span>
      </div>
      <div className="absolute top-24 right-32 md:right-64 opacity-80" style={{ animation: "doodle-float 5s ease-in-out infinite", animationDelay: "1s" }}>
        <span className="material-icons-round text-[#8B5CF6] text-4xl">music_note</span>
      </div>
      <div className="absolute bottom-32 left-40 md:left-72 opacity-80" style={{ animation: "doodle-float 6s ease-in-out infinite", animationDelay: "2s" }}>
        <span className="material-icons-round text-indigo-200 text-5xl">bolt</span>
      </div>
      <div className="absolute bottom-40 right-40 md:right-72 animate-float opacity-80">
        <span className="material-icons-round text-primary text-4xl">music_note</span>
      </div>

      {/* Decorative dots */}
      <div className="absolute top-1/4 right-1/3 w-2 h-2 rounded-full bg-primary animate-pulse" />
      <div className="absolute bottom-1/3 left-1/3 w-1.5 h-1.5 rounded-full bg-[#8B5CF6] animate-pulse" style={{ animationDelay: "700ms" }} />

      {/* Decorative dashed path */}
      <svg className="absolute top-1/2 left-20 md:left-52 -translate-y-1/2 opacity-60 text-[#8B5CF6]" fill="none" height="60" viewBox="0 0 24 60" width="24">
        <path d="M12 2C4.5 9.5 24.5 19.5 12 29.5C-0.5 39.5 19.5 49.5 12 58" stroke="currentColor" strokeDasharray="4 4" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
      </svg>

      {/* Main content */}
      <main className="relative z-10 flex flex-col items-center justify-center w-full max-w-lg mx-auto p-6 text-center space-y-12">
        <h1 className="text-4xl md:text-5xl font-bold tracking-tight">
          Thanks for using <br />
          <span className="text-primary mt-2 inline-block">syncify</span>
        </h1>

        <div className="flex flex-col items-center space-y-8 w-full max-w-sm mx-auto">
          {/* Delete my data button */}
          <button
            className="w-full py-4 px-6 bg-red-500 hover:bg-red-600 transition-colors rounded-full text-white font-semibold text-lg shadow-[0_0_20px_rgba(239,68,68,0.3)] disabled:opacity-70 flex items-center justify-center gap-3"
            disabled={deleteState === "done"}
            onClick={() => void handleDelete()}
          >
            <span>{deleteState === "done" ? "Deleted" : "Delete my data"}</span>
            {deleteState === "deleting" && (
              <div className="w-5 h-5 border-3 border-white/30 border-t-white rounded-full animate-spin" />
            )}
            {deleteState === "done" && (
              <span className="material-icons-round text-white text-xl">check_circle</span>
            )}
          </button>

          {/* Buy me a coffee */}
          <a
            className="group flex items-center justify-center gap-3 cursor-pointer hover:scale-105 transition-transform"
            href="https://ko-fi.com/darshangoswami"
            rel="noopener noreferrer"
            target="_blank"
          >
            <span className="font-handwriting text-2xl md:text-3xl text-yellow-500 group-hover:text-yellow-400 transition-colors">
              Buy me a coffee?
            </span>
            <svg
              className="w-10 h-10 text-yellow-500 group-hover:text-yellow-400 -rotate-6 group-hover:rotate-6 transition-all"
              fill="none"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2.5"
              viewBox="0 0 24 24"
            >
              <path d="M18 8h1a4 4 0 0 1 0 8h-1" />
              <path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z" />
              <path d="M6 1v3" />
              <path d="M10 1v3" />
              <path d="M14 1v3" />
              <path d="M7 13c.5 1 2.5 1 3 0" strokeWidth="2" />
              <circle cx="7" cy="10.5" fill="currentColor" r="0.8" stroke="none" />
              <circle cx="10" cy="10.5" fill="currentColor" r="0.8" stroke="none" />
            </svg>
          </a>
        </div>
      </main>

      {/* Bottom: Need another transfer */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2">
        <button
          className="flex items-center gap-2 text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200 transition-colors text-sm font-medium"
          onClick={() => router.push("/select-sources")}
        >
          <span className="material-icons-round text-lg">refresh</span>
          <span>Need another Transfer?</span>
        </button>
      </div>
    </div>
  );
}
