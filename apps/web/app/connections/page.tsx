"use client";

import type { FormEvent, ReactElement } from "react";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

interface ConnectionStatus {
  approved: boolean;
  spotifyConnected: boolean;
  tidalConnected: boolean;
}

function handleConnectClick(
  event: React.MouseEvent<HTMLAnchorElement>,
  href: string
): void {
  if (typeof window === "undefined") return;
  const { hostname } = window.location;
  if (hostname !== "localhost" && hostname !== "[::1]") return;
  event.preventDefault();
  const url = new URL(href, window.location.origin);
  url.hostname = "127.0.0.1";
  window.location.assign(url.toString());
}

export default function ConnectionsPage(): ReactElement {
  const [status, setStatus] = useState<ConnectionStatus | null>(null);
  const [loading, setLoading] = useState(true);

  // Approval check state
  const [approvalEmail, setApprovalEmail] = useState("");
  const [approvalBusy, setApprovalBusy] = useState(false);
  const [approvalError, setApprovalError] = useState("");

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/status");
      if (res.ok) {
        const data = (await res.json()) as ConnectionStatus;
        setStatus(data);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchStatus();
  }, [fetchStatus]);

  async function handleApprovalCheck(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setApprovalError("");
    setApprovalBusy(true);

    try {
      const response = await fetch("/api/invite/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: approvalEmail })
      });

      if (!response.ok) {
        setApprovalError("Could not verify approval.");
        return;
      }

      const payload = (await response.json()) as { approved?: boolean };
      if (payload.approved) {
        setLoading(true);
        await fetchStatus();
      } else {
        setApprovalError(
          "Not approved yet. Request an invite first if you haven't already."
        );
      }
    } catch {
      setApprovalError("Could not verify approval.");
    } finally {
      setApprovalBusy(false);
    }
  }

  const bothConnected = status?.spotifyConnected && status?.tidalConnected;

  if (loading) {
    return (
      <div className="min-h-dvh bg-background-dark flex flex-col items-center justify-center">
        <div className="relative w-12 h-12 mb-4">
          <div className="absolute inset-0 border-4 border-dashed border-primary rounded-full animate-spin" />
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="material-icons-round text-primary">sync</span>
          </div>
        </div>
        <p className="text-zinc-500 text-sm font-bold">Loading...</p>
      </div>
    );
  }

  // Not approved — show approval check form
  if (!status?.approved) {
    return (
      <div className="min-h-dvh bg-background-dark flex flex-col relative">
        {/* Nav */}
        <nav className="p-6 md:p-10 absolute top-0 left-0 w-full z-10">
          <Link
            href="/"
            className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-zinc-800 hover:bg-zinc-700 transition-colors"
          >
            <span className="material-icons-round text-white">arrow_back</span>
          </Link>
        </nav>

        <main className="flex-grow flex flex-col lg:flex-row items-center justify-center px-6 md:px-16 lg:px-24 pt-24 pb-32 max-w-7xl mx-auto w-full z-10">
          {/* Left side — text + form */}
          <div className="w-full lg:w-1/2 pr-0 lg:pr-16 flex flex-col justify-center mb-16 lg:mb-0">
            <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight mb-6 leading-tight">
              Verify your<br />
              <span className="text-primary italic font-semibold">access</span>
            </h1>
            <p className="text-zinc-400 text-lg md:text-xl mb-12 max-w-md">
              Enter the email you used to request an invite. We&apos;ll check
              if you&apos;ve been approved.
            </p>

            <form className="w-full max-w-md space-y-6" onSubmit={handleApprovalCheck}>
              <div>
                <label
                  className="block text-xs font-semibold tracking-wider text-zinc-500 uppercase mb-2 ml-1"
                  htmlFor="approval-email"
                >
                  Approved Email
                </label>
                <input
                  className={`w-full bg-zinc-900 border-2 ${
                    approvalError ? "border-red-500" : "border-transparent"
                  } focus:border-primary focus:ring-0 rounded-xl px-5 py-4 text-white placeholder-zinc-600 transition-all outline-none`}
                  id="approval-email"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  required
                  placeholder="you@example.com"
                  value={approvalEmail}
                  onChange={(e) => {
                    setApprovalEmail(e.target.value);
                    setApprovalError("");
                  }}
                />
                {approvalError && (
                  <div className="text-red-500 text-sm mt-2 font-medium px-1 flex items-center gap-1">
                    <span className="material-icons-round text-base">error_outline</span>
                    <span>{approvalError}</span>
                  </div>
                )}
              </div>

              <button
                className="w-full bg-primary hover:bg-green-500 text-black font-bold text-lg rounded-xl px-5 py-4 flex items-center justify-center gap-2 transition-all transform hover:-translate-y-1 active:scale-95 disabled:opacity-60"
                type="submit"
                disabled={approvalBusy}
              >
                {approvalBusy ? "Checking..." : "Verify Access"}
                <span className="material-icons-round">arrow_forward</span>
              </button>
            </form>
          </div>

          {/* Right side — illustration (desktop only) */}
          <div className="hidden lg:flex w-full lg:w-1/2 justify-end relative items-center min-h-[400px]">
            {/* Decorative star */}
            <div className="absolute top-10 right-10 animate-bounce" style={{ animationDuration: "3000ms" }}>
              <svg
                className="text-primary opacity-20"
                fill="none"
                height="60"
                viewBox="0 0 60 60"
                width="60"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M30 0C30 0 32 20 50 30C32 40 30 60 30 60C30 60 28 40 10 30C28 20 30 0 30 0Z"
                  fill="currentColor"
                />
              </svg>
            </div>

            {/* Decorative circle */}
            <div className="absolute bottom-10 left-10 rotate-12">
              <svg
                className="text-blue-500 opacity-30"
                fill="none"
                height="40"
                viewBox="0 0 40 40"
                width="40"
                xmlns="http://www.w3.org/2000/svg"
              >
                <circle
                  cx="20"
                  cy="20"
                  r="15"
                  stroke="currentColor"
                  strokeDasharray="4 4"
                  strokeWidth="4"
                />
              </svg>
            </div>

            <div className="relative w-80 h-80 bg-primary rounded-[2rem] -rotate-[5deg] flex items-center justify-center shadow-2xl shadow-green-900/20">
              <span className="material-icons-round text-white text-6xl">verified_user</span>
              <div className="absolute -top-4 -right-4 w-14 h-14 bg-white rounded-full flex items-center justify-center shadow-lg border-4 border-background-dark rotate-12">
                <span className="material-icons-round text-black font-bold text-2xl">bolt</span>
              </div>
            </div>
          </div>
        </main>

        {/* Wave decoration */}
        <div className="absolute bottom-0 left-0 w-full overflow-hidden leading-none z-0 pointer-events-none opacity-40">
          <svg preserveAspectRatio="none" style={{ height: "150px", width: "100%" }} viewBox="0 0 500 150">
            <path
              className="fill-primary"
              d="M0.00,49.98 C150.00,150.00 349.20,-50.00 500.00,49.98 L500.00,150.00 L0.00,150.00 Z"
            />
          </svg>
        </div>
      </div>
    );
  }

  // Approved — show provider connections
  return (
    <div className="min-h-dvh bg-background-dark flex flex-col antialiased">
      <header className="flex items-center justify-between p-6 w-full max-w-5xl mx-auto">
        <Link
          href="/"
          className="w-10 h-10 rounded-full bg-card-dark flex items-center justify-center hover:bg-zinc-700 transition-colors"
        >
          <span className="material-icons-round text-white">arrow_back</span>
        </Link>
        <h1 className="text-xl font-bold">Connections</h1>
        <div className="w-10" />
      </header>

      <main className="flex-grow flex flex-col items-center px-6 pb-24 w-full max-w-5xl mx-auto">
        {/* Heading */}
        <div className="w-full text-left mb-8 relative">
          <h2 className="text-4xl md:text-5xl font-extrabold mb-2">
            Link your<br />
            <span className="text-primary italic">providers</span>
          </h2>
          <p className="text-zinc-400 text-base md:text-lg max-w-md mt-4">
            Connect your music services to start moving your favorite playlists
            and albums.
          </p>
          <div className="absolute top-0 right-10 text-primary opacity-50 hidden md:block doodle-float">
            <span className="material-icons-round text-[2rem]">auto_awesome</span>
          </div>
        </div>

        {/* Provider Cards */}
        <div className="w-full grid grid-cols-1 md:grid-cols-2 gap-6 mb-10">
          {/* Spotify Card */}
          {status.spotifyConnected ? (
            <div className="bg-spotify rounded-xl p-6 relative overflow-hidden text-white flex flex-col justify-between h-56">
              <div className="absolute right-0 top-0 h-full w-1/2 opacity-20 pointer-events-none">
                <svg className="w-full h-full" viewBox="0 0 100 100">
                  <circle cx="80" cy="50" fill="white" r="40" />
                  <circle cx="80" cy="50" fill="none" r="60" stroke="white" strokeWidth="10" />
                  <circle cx="80" cy="50" fill="none" r="80" stroke="white" strokeWidth="10" />
                </svg>
              </div>
              <div className="flex justify-between items-start z-10">
                <div>
                  <h3 className="text-3xl font-bold mb-1">Spotify</h3>
                  <p className="text-sm font-medium opacity-90">Free Tier Account</p>
                </div>
                <div className="w-10 h-10 bg-white/30 backdrop-blur-sm rounded-full flex items-center justify-center">
                  <span className="material-icons-round text-white">check_circle</span>
                </div>
              </div>
              <div className="flex justify-between items-end z-10">
                <span className="bg-white text-spotify font-bold py-2 px-4 rounded-full text-sm uppercase tracking-wider">
                  Connected
                </span>
                <p className="text-xs font-medium opacity-90">Last synced just now</p>
              </div>
            </div>
          ) : (
            <a
              href="/api/auth/spotify/start"
              onClick={(e) => handleConnectClick(e, "/api/auth/spotify/start")}
              className="bg-spotify rounded-xl p-6 relative overflow-hidden text-white flex flex-col justify-between h-56 transition-all duration-300 active:scale-95 hover:opacity-95 block"
            >
              <div className="absolute right-0 top-0 h-full w-1/2 opacity-20 pointer-events-none">
                <svg className="w-full h-full" viewBox="0 0 100 100">
                  <circle cx="80" cy="50" fill="white" r="40" />
                  <circle cx="80" cy="50" fill="none" r="60" stroke="white" strokeWidth="10" />
                  <circle cx="80" cy="50" fill="none" r="80" stroke="white" strokeWidth="10" />
                </svg>
              </div>
              <div className="flex justify-between items-start z-10">
                <div>
                  <h3 className="text-3xl font-bold mb-1">Spotify</h3>
                  <p className="text-sm font-medium opacity-80">Music Streaming</p>
                </div>
                <div className="w-10 h-10 bg-white/10 rounded-full flex items-center justify-center border border-white/20">
                  <span className="material-icons-round text-white/50">add_link</span>
                </div>
              </div>
              <div className="flex justify-between items-end z-10">
                <span className="bg-white text-spotify font-bold py-2 px-4 rounded-full text-sm uppercase tracking-wider flex items-center">
                  Connect
                  <span className="material-icons-round text-xs ml-2">arrow_forward_ios</span>
                </span>
                <p className="text-xs font-medium opacity-50">Setup required</p>
              </div>
            </a>
          )}

          {/* TIDAL Card */}
          {status.tidalConnected ? (
            <div className="bg-card-dark border border-zinc-700 rounded-xl p-6 relative overflow-hidden flex flex-col justify-between h-56">
              <div className="absolute -right-4 -bottom-4 h-32 w-32 opacity-20 pointer-events-none flex flex-wrap gap-1">
                <div className="w-10 h-10 bg-tidal rotate-45 transform translate-x-5 translate-y-5" />
                <div className="w-10 h-10 bg-tidal rotate-45 transform translate-x-10 translate-y-0" />
                <div className="w-10 h-10 bg-tidal rotate-45 transform translate-x-0 translate-y-10" />
                <div className="w-10 h-10 bg-tidal rotate-45 transform translate-x-[3.75rem] translate-y-[3.75rem]" />
              </div>
              <div className="flex justify-between items-start z-10">
                <div>
                  <h3 className="text-3xl font-bold mb-1 text-white">TIDAL</h3>
                  <p className="text-sm font-medium text-zinc-400">High Fidelity Audio</p>
                </div>
                <div className="w-10 h-10 bg-zinc-700 rounded-full flex items-center justify-center border border-zinc-600">
                  <span className="material-icons-round text-tidal">check_circle</span>
                </div>
              </div>
              <div className="flex justify-between items-end z-10">
                <span className="bg-tidal text-black font-bold py-2 px-4 rounded-full text-sm uppercase tracking-wider">
                  Connected
                </span>
                <p className="text-xs font-medium text-zinc-400">Last synced just now</p>
              </div>
            </div>
          ) : (
            <a
              href="/api/auth/tidal/start"
              onClick={(e) => handleConnectClick(e, "/api/auth/tidal/start")}
              className="bg-card-dark border border-zinc-700 rounded-xl p-6 relative overflow-hidden flex flex-col justify-between h-56 transition-all duration-300 active:scale-95 hover:border-zinc-600 block"
            >
              <div className="absolute -right-4 -bottom-4 h-32 w-32 opacity-20 pointer-events-none flex flex-wrap gap-1">
                <div className="w-10 h-10 bg-tidal rotate-45 transform translate-x-5 translate-y-5" />
                <div className="w-10 h-10 bg-tidal rotate-45 transform translate-x-10 translate-y-0" />
                <div className="w-10 h-10 bg-tidal rotate-45 transform translate-x-0 translate-y-10" />
                <div className="w-10 h-10 bg-tidal rotate-45 transform translate-x-[3.75rem] translate-y-[3.75rem]" />
              </div>
              <div className="flex justify-between items-start z-10">
                <div>
                  <h3 className="text-3xl font-bold mb-1 text-white">TIDAL</h3>
                  <p className="text-sm font-medium text-zinc-500">High Fidelity Audio</p>
                </div>
                <div className="w-10 h-10 bg-zinc-700 rounded-full flex items-center justify-center border border-zinc-600">
                  <span className="material-icons-round text-zinc-500">add_link</span>
                </div>
              </div>
              <div className="flex justify-between items-end z-10">
                <span className="bg-tidal text-black font-bold py-2 px-4 rounded-full text-sm uppercase tracking-wider flex items-center hover:bg-white transition-colors">
                  Connect
                  <span className="material-icons-round text-xs ml-2">arrow_forward_ios</span>
                </span>
                <p className="text-xs font-medium text-zinc-500">Setup required</p>
              </div>
            </a>
          )}
        </div>

        {/* Start Transfer */}
        {bothConnected ? (
          <Link
            href="/select-sources"
            className="w-full bg-primary text-black font-bold text-lg py-4 px-6 rounded-xl hover:opacity-90 transition-colors flex items-center justify-center space-x-2"
          >
            <span>Start Transfer</span>
            <span className="material-icons-round">shuffle</span>
          </Link>
        ) : (
          <button
            className="w-full bg-primary text-black font-bold text-lg py-4 px-6 rounded-xl flex items-center justify-center space-x-2 disabled:opacity-50 disabled:grayscale"
            disabled
          >
            <span>Start Transfer</span>
            <span className="material-icons-round">shuffle</span>
          </button>
        )}
      </main>

      <footer className="w-full py-6 text-center text-xs font-semibold tracking-widest text-zinc-400 uppercase mt-auto">
        Secured by OAuth 2.0 + PKCE
      </footer>
    </div>
  );
}
