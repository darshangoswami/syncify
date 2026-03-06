import type { ReactElement } from "react";
import Link from "next/link";

export default function LandingPage(): ReactElement {
  return (
    <div className="min-h-dvh bg-background-dark flex flex-col items-center justify-center p-6 relative">
      <div className="max-w-4xl w-full flex flex-col items-center text-center space-y-12">
        {/* Logo */}
        <div className="space-y-6 flex flex-col items-center">
          <div className="relative">
            <h1 className="text-6xl font-extrabold tracking-tight text-white">
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
          <div className="inline-flex items-center px-4 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-semibold tracking-wide border border-primary/20">
            BETA ACCESS
          </div>
        </div>

        {/* Heading */}
        <div className="max-w-2xl space-y-6">
          <h2 className="text-4xl md:text-5xl font-bold tracking-tight leading-tight">
            Your library, <br />
            everywhere you go.
          </h2>
          <p className="text-lg md:text-xl text-zinc-400">
            Move your playlists, liked songs, and followed artists from Spotify
            to TIDAL in seconds. No data loss, no hassle.
          </p>
        </div>

        {/* Action Cards */}
        <div className="w-full grid grid-cols-1 md:grid-cols-2 gap-6 mt-8 relative z-10">
          {/* Request Invite Card */}
          <Link href="/request-invite" className="group block transition-transform hover:scale-[1.02] active:scale-95">
            <div className="bg-primary rounded-[2rem] p-8 flex flex-col justify-between items-start h-64 shadow-xl shadow-primary/20 relative overflow-hidden">
              <div className="absolute -top-4 -right-4 opacity-20 transform rotate-12">
                <span className="material-icons-round text-[120px] text-white">auto_awesome</span>
              </div>
              <span className="inline-flex items-center px-3 py-1 rounded-md bg-white/20 text-white text-xs font-bold tracking-wider uppercase backdrop-blur-sm">
                Waitlist
              </span>
              <div className="w-full flex items-center justify-between mt-auto">
                <h3 className="text-3xl font-bold text-white">Request Invite</h3>
                <div className="w-14 h-14 bg-white rounded-full flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
                  <span className="material-icons-round text-3xl">arrow_forward</span>
                </div>
              </div>
            </div>
          </Link>

          {/* Already Approved Card */}
          <Link href="/connections" className="group block transition-transform hover:scale-[1.02] active:scale-95">
            <div className="bg-card-dark rounded-[2rem] p-8 border border-zinc-800 flex flex-col justify-between items-start h-64 relative overflow-hidden">
              <div className="w-full flex justify-end">
                <span className="material-icons-round text-zinc-600 text-3xl">celebration</span>
              </div>
              <div className="w-full space-y-4">
                <div className="space-y-2 text-left">
                  <h3 className="text-2xl font-bold text-white">Already Approved?</h3>
                  <p className="text-zinc-400">Sign in with your approved email</p>
                </div>
                <div className="flex items-center text-primary font-semibold text-lg group-hover:gap-2 transition-all">
                  Enter Portal <span className="material-icons-round ml-1">login</span>
                </div>
              </div>
            </div>
          </Link>
        </div>

        {/* Footer */}
        <div className="pt-12 pb-6 max-w-md mx-auto">
          <p className="text-sm text-zinc-500 text-center">
            Transfer functionality is currently locked for beta users only. Join
            the waitlist for early access.
          </p>
        </div>
      </div>

      {/* Decorative floating icons */}
      <div className="absolute top-1/2 left-8 -translate-y-1/2 opacity-20 pointer-events-none doodle-float">
        <span className="material-icons-round text-5xl text-secondary">music_note</span>
      </div>
      <div className="absolute bottom-24 right-8 opacity-20 pointer-events-none doodle-float">
        <span className="material-icons-round text-6xl text-primary">headphones</span>
      </div>
    </div>
  );
}
