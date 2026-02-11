import type { ReactElement } from "react";
import Link from "next/link";

export default function LandingPage(): ReactElement {
  return (
    <div className="flex justify-center min-h-dvh">
      <div className="relative w-full max-w-100 min-h-dvh bg-background-dark flex flex-col">
        {/* Main content */}
        <div className="flex-1 overflow-y-auto px-6 pt-4 pb-8 relative">
          {/* Logo */}
          <div className="relative mb-12 flex flex-col items-center">
            <div className="relative">
              <h1 className="text-6xl font-extrabold tracking-tighter text-white mb-2">
                sync<span className="text-primary">ify</span>
              </h1>
              <svg
                className="absolute -bottom-2 left-0 w-full"
                fill="none"
                height="12"
                viewBox="0 0 200 12"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  className="doodle-path"
                  d="M2 10C30 2 70 2 100 10C130 2 170 2 198 10"
                  stroke="#22C55E"
                  strokeLinecap="round"
                  strokeWidth="4"
                />
              </svg>
            </div>
            <div className="mt-8 flex gap-2">
              <span className="px-3 py-1 bg-primary/10 rounded-full text-[10px] font-bold uppercase tracking-widest text-primary">
                Beta Access
              </span>
            </div>
          </div>

          {/* Heading */}
          <div className="text-center mb-10">
            <h2 className="text-2xl font-bold leading-tight mb-3">
              Your library, <br />
              everywhere you go.
            </h2>
            <p className="text-zinc-400 text-sm leading-relaxed px-4">
              Move your playlists, liked songs, and followed artists from Spotify
              to TIDAL in seconds. No data loss, no hassle.
            </p>
          </div>

          {/* Action Cards */}
          <div className="space-y-4 relative z-10">
            {/* Request Invite Card */}
            <Link href="/request-invite" className="w-full text-left group block transition-transform active:scale-95">
              <div className="bg-primary p-6 rounded-[32px] relative overflow-hidden flex flex-col h-48 justify-between shadow-xl shadow-primary/20">
                <div className="absolute -top-4 -right-4 opacity-20 transform rotate-12">
                  <span className="material-icons-round text-[120px] text-white">auto_awesome</span>
                </div>
                <div>
                  <span className="bg-white/20 text-white text-[10px] font-bold px-2 py-1 rounded-md uppercase tracking-wider">
                    Waitlist
                  </span>
                  <h3 className="text-2xl font-extrabold text-white mt-3">Request Invite</h3>
                </div>
                <div className="flex items-center justify-between">
                  <p className="text-white/80 text-sm font-medium">Join 12k+ others</p>
                  <div className="bg-white text-primary p-2 rounded-full flex items-center justify-center">
                    <span className="material-icons-round">arrow_forward</span>
                  </div>
                </div>
              </div>
            </Link>

            {/* Already Approved Card */}
            <Link href="/connections" className="w-full text-left group block transition-transform active:scale-95">
              <div className="bg-zinc-900 border-2 border-zinc-800 p-6 rounded-[32px] relative overflow-hidden flex flex-col h-40 justify-between">
                <div className="absolute top-4 right-4 text-secondary opacity-30">
                  <span className="material-icons-round text-4xl">celebration</span>
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white">Already Approved?</h3>
                  <p className="text-zinc-500 text-sm mt-1">Sign in with your access code</p>
                </div>
                <div className="flex items-center text-primary font-bold text-sm">
                  Enter Portal{" "}
                  <span className="material-icons-round ml-1 text-[18px]">login</span>
                </div>
              </div>
            </Link>
          </div>

          {/* Decorative floating icons */}
          <div className="absolute top-1/2 left-4 -translate-y-1/2 opacity-20 pointer-events-none">
            <span className="material-icons-round text-5xl text-secondary">music_note</span>
          </div>
          <div className="absolute bottom-24 right-4 opacity-20 pointer-events-none">
            <span className="material-icons-round text-6xl text-primary">headphones</span>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-8 bg-gradient-to-t from-background-dark via-background-dark to-transparent">
          <p className="text-center text-[11px] text-zinc-600 px-8 leading-tight">
            Transfer functionality is currently locked for beta users only. Join
            the waitlist for early access.
          </p>
        </div>
      </div>
    </div>
  );
}
