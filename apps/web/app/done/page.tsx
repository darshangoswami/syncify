"use client";

import type { ReactElement } from "react";
import { useState } from "react";
import { useRouter } from "next/navigation";

type DeleteState = "idle" | "deleting" | "done";

const CACHE_KEY = "syncify:library";

export default function DonePage(): ReactElement {
  const router = useRouter();
  const [deleteState, setDeleteState] = useState<DeleteState>("idle");

  async function handleDelete(): Promise<void> {
    if (deleteState !== "idle") return;
    setDeleteState("deleting");

    try {
      sessionStorage.removeItem(CACHE_KEY);
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
    <div className="fixed inset-0 flex justify-center">
      <div className="relative w-full max-w-100 h-full bg-black overflow-hidden flex flex-col">
        {/* Spacer for top padding */}
        <div className="px-6 py-4" />

        {/* Content */}
        <div className="flex-1 flex flex-col items-center justify-center -mt-20 px-8">
          <h1 className="text-4xl font-extrabold text-white text-center leading-tight mb-2">
            Thanks for using <span className="text-primary">syncify</span>
          </h1>
          <div className="w-full flex flex-col items-center gap-8 mt-12">
            {/* Delete my data button */}
            <button
              className="w-full max-w-70 h-16 bg-[#FF3B30] hover:bg-red-600 active:scale-95 transition-all rounded-full flex items-center justify-center gap-3 shadow-[0_10px_30px_-10px_rgba(255,59,48,0.5)] disabled:opacity-70"
              disabled={deleteState === "done"}
              onClick={() => void handleDelete()}
            >
              <span className="text-white font-bold text-lg">{deleteState === "done" ? "Deleted" : "Delete my data"}</span>
              {deleteState === "deleting" && (
                <div className="w-5 h-5 border-3 border-white/30 border-t-white rounded-full animate-spin" />
              )}
              {deleteState === "done" && (
                <span className="material-icons-round text-white text-xl">check_circle</span>
              )}
            </button>

            {/* Buy me a coffee */}
            <a
              className="group relative flex items-center gap-3 px-6 py-2 transition-transform hover:scale-105 active:scale-95 hover:rotate-2"
              href="#"
              rel="noopener noreferrer"
              target="_blank"
            >
              <span className="font-handwriting text-3xl text-[rgb(247,224,94)] drop-shadow-[2px_2px_0_rgba(0,0,0,1)] tracking-wide font-bold">
                Buy me a coffee?
              </span>
              <svg
                className="w-10 h-10 text-[rgb(247,224,94)] drop-shadow-[2px_2px_0_rgba(0,0,0,1)] -rotate-6 group-hover:rotate-6 transition-transform"
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
        </div>

        {/* Bottom: Need another transfer */}
        <div className="px-8 pb-8 flex justify-center">
          <button
            className="flex items-center justify-center gap-2 text-zinc-400 hover:text-white font-bold text-sm transition-colors active:scale-95"
            onClick={() => router.push("/select-sources")}
          >
            <span className="material-icons-round text-lg">refresh</span>
            Need another Transfer?
          </button>
        </div>

        {/* Decorative stickers */}
        <div className="absolute top-32 right-8 animate-float opacity-80" style={{ animationDelay: "0.5s" }}>
          <svg fill="none" height="40" viewBox="0 0 24 24" width="40">
            <path d="M9 18V5L21 3V16" stroke="#7C5DFF" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
            <circle cx="6" cy="18" fill="#7C5DFF" r="3" />
            <circle cx="18" cy="16" fill="#7C5DFF" r="3" />
          </svg>
        </div>
        <div className="absolute top-40 left-6 animate-float" style={{ animationDelay: "1.2s" }}>
          <svg className="text-primary" fill="none" height="32" viewBox="0 0 24 24" width="32">
            <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
          </svg>
        </div>
        <div className="absolute bottom-40 left-8 animate-float" style={{ animationDelay: "2s" }}>
          <svg fill="none" height="48" viewBox="0 0 24 24" width="48">
            <path d="M13 2L3 14H12L11 22L21 10H12L13 2Z" fill="#7C5DFF" stroke="white" strokeLinejoin="round" strokeWidth="1.5" />
          </svg>
        </div>
        <div className="absolute bottom-32 right-6 animate-float" style={{ animationDelay: "0.8s" }}>
          <svg className="rotate-12" fill="none" height="36" viewBox="0 0 24 24" width="36">
            <path d="M9 17V5L20 3V15" stroke="#22c55e" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" />
            <circle cx="6" cy="17" fill="#22c55e" r="3" />
            <circle cx="17" cy="15" fill="#22c55e" r="3" />
          </svg>
        </div>

        {/* Decorative dots */}
        <div className="absolute top-1/2 left-2 opacity-50 pointer-events-none">
          <svg fill="none" height="80" viewBox="0 0 40 80" width="40">
            <path d="M10 10 C 30 20, 0 40, 20 50 S 10 80, 30 70" stroke="#7C5DFF" strokeDasharray="4 4" strokeLinecap="round" strokeWidth="2" />
          </svg>
        </div>
        <div className="absolute top-1/4 right-1/4 w-2 h-2 bg-primary rounded-full animate-pulse" />
        <div className="absolute bottom-1/3 left-1/3 w-1.5 h-1.5 bg-[#7C5DFF] rounded-full animate-pulse" style={{ animationDelay: "1s" }} />
      </div>
    </div>
  );
}
