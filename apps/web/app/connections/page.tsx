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
      <div className="flex justify-center min-h-dvh">
        <div className="relative w-full max-w-100 min-h-dvh bg-background-dark flex flex-col items-center justify-center">
          <div className="relative w-12 h-12 mb-4">
            <div className="absolute inset-0 border-4 border-dashed border-primary rounded-full animate-spin" />
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="material-icons-round text-primary">sync</span>
            </div>
          </div>
          <p className="text-zinc-500 text-sm font-bold">Loading...</p>
        </div>
      </div>
    );
  }

  // Not approved — show approval check form
  if (!status?.approved) {
    return (
      <div className="flex justify-center min-h-dvh">
        <div className="relative w-full max-w-100 min-h-dvh bg-background-dark flex flex-col">
          <div className="flex-1 px-6 pt-4 flex flex-col relative z-10">
            {/* Header */}
            <div className="flex items-center justify-between mb-8">
              <Link
                href="/"
                className="w-10 h-10 flex items-center justify-center rounded-full bg-card-dark text-slate-300"
              >
                <span className="material-icons-round">arrow_back</span>
              </Link>
              <h1 className="text-xl font-extrabold tracking-tight">Connections</h1>
              <div className="w-10" />
            </div>

            <div className="mb-10 px-2">
              <h2 className="text-3xl font-black mb-3 leading-tight">
                Verify your<br />
                <span className="text-primary italic">access</span>
              </h2>
              <p className="text-slate-400 text-sm font-medium leading-relaxed max-w-[80%]">
                Enter the email you used to request an invite. We&apos;ll check if
                you&apos;ve been approved.
              </p>
            </div>

            <form className="space-y-6 px-2" onSubmit={handleApprovalCheck}>
              <div className="space-y-2">
                <label
                  className="text-xs font-bold uppercase tracking-widest text-zinc-500 px-1"
                  htmlFor="approval-email"
                >
                  Approved Email
                </label>
                <input
                  className={`w-full bg-zinc-900 border-2 ${
                    approvalError ? "border-red-500" : "border-transparent"
                  } focus:border-primary focus:ring-0 rounded-2xl px-6 py-4 text-lg font-semibold transition-all duration-200 outline-none placeholder:opacity-30`}
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
                className="w-full bg-primary hover:bg-emerald-400 text-zinc-900 font-extrabold text-lg py-5 rounded-2xl flex items-center justify-center gap-3 transition-all active:scale-95 shadow-lg shadow-primary/20 disabled:opacity-60"
                type="submit"
                disabled={approvalBusy}
              >
                {approvalBusy ? "Checking..." : "Verify Access"}
                <span className="material-icons-round">arrow_forward</span>
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  // Approved — show provider connections
  return (
    <div className="flex justify-center min-h-dvh">
      <div className="relative w-full max-w-100 min-h-dvh bg-background-dark flex flex-col">
        {/* Floating decorative icons */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute top-20 right-10 doodle-float text-primary opacity-40">
            <span className="material-icons-round text-4xl">auto_awesome</span>
          </div>
          <div
            className="absolute bottom-40 left-8 doodle-float text-blue-500 opacity-40"
            style={{ animationDelay: "-2s" }}
          >
            <span className="material-icons-round text-3xl">star_border</span>
          </div>
          <div
            className="absolute top-1/2 -right-4 doodle-float opacity-30 transform -rotate-12"
            style={{ animationDelay: "-4s" }}
          >
            <span className="material-icons-round text-6xl">dark_mode</span>
          </div>
        </div>

        <div className="flex-1 px-6 pt-4 flex flex-col relative z-10">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <Link
              href="/"
              className="w-10 h-10 flex items-center justify-center rounded-full bg-card-dark text-slate-300"
            >
              <span className="material-icons-round">arrow_back</span>
            </Link>
            <h1 className="text-xl font-extrabold tracking-tight">Connections</h1>
            <div className="w-10" />
          </div>

          {/* Heading */}
          <div className="mb-10 px-2">
            <h2 className="text-3xl font-black mb-3 leading-tight">
              Link your<br />
              <span className="text-primary italic">providers</span>
            </h2>
            <p className="text-slate-400 text-sm font-medium leading-relaxed max-w-[80%]">
              Connect your music services to start moving your favorite playlists
              and albums.
            </p>
          </div>

          {/* Provider Cards */}
          <div className="space-y-4 flex-1">
            {/* Spotify Card */}
            {status.spotifyConnected ? (
              <div className="group relative overflow-hidden bg-spotify rounded-[32px] p-6 text-white shadow-xl">
                <div className="absolute top-[-20px] right-[-20px] opacity-10">
                  <svg className="w-40 h-40 fill-white" viewBox="0 0 24 24">
                    <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.503 17.306c-.218.358-.684.474-1.041.256-2.858-1.747-6.456-2.143-10.693-1.173-.41.094-.82-.164-.914-.573-.094-.41.164-.82.573-.914 4.636-1.06 8.608-.609 11.819 1.353.357.218.473.684.256 1.041zm1.469-3.261c-.274.446-.853.587-1.3.312-3.272-2.011-8.259-2.593-12.128-1.417-.504.153-1.037-.132-1.191-.636-.154-.504.131-1.037.636-1.191 4.417-1.34 9.914-.688 13.671 1.62.447.275.588.854.312 1.302zm.127-3.41c-3.924-2.33-10.388-2.545-14.151-1.403-.602.183-1.242-.167-1.425-.769-.182-.602.167-1.242.769-1.425 4.314-1.309 11.451-1.055 15.986 1.636.541.321.716 1.02.395 1.561-.322.541-1.02.716-1.561.395l-.013.005z" />
                  </svg>
                </div>
                <div className="relative z-10">
                  <div className="flex justify-between items-start mb-10">
                    <div>
                      <h3 className="text-2xl font-black tracking-tight">Spotify</h3>
                      <p className="text-xs font-bold opacity-80 mt-1">Free Tier Account</p>
                    </div>
                    <div className="w-12 h-12 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center">
                      <span className="material-icons-round text-white">check_circle</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="px-4 py-2 bg-white text-spotify text-[11px] font-black uppercase tracking-widest rounded-full">
                      Connected
                    </span>
                    <span className="text-[10px] font-bold opacity-60">Last synced just now</span>
                  </div>
                </div>
              </div>
            ) : (
              <a
                href="/api/auth/spotify/start"
                onClick={(e) => handleConnectClick(e, "/api/auth/spotify/start")}
                className="group relative overflow-hidden bg-spotify rounded-[32px] p-6 text-white shadow-xl transition-all duration-300 active:scale-95 block"
              >
                <div className="absolute top-[-20px] right-[-20px] opacity-10 group-hover:scale-110 transition-transform">
                  <svg className="w-40 h-40 fill-white" viewBox="0 0 24 24">
                    <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.503 17.306c-.218.358-.684.474-1.041.256-2.858-1.747-6.456-2.143-10.693-1.173-.41.094-.82-.164-.914-.573-.094-.41.164-.82.573-.914 4.636-1.06 8.608-.609 11.819 1.353.357.218.473.684.256 1.041zm1.469-3.261c-.274.446-.853.587-1.3.312-3.272-2.011-8.259-2.593-12.128-1.417-.504.153-1.037-.132-1.191-.636-.154-.504.131-1.037.636-1.191 4.417-1.34 9.914-.688 13.671 1.62.447.275.588.854.312 1.302zm.127-3.41c-3.924-2.33-10.388-2.545-14.151-1.403-.602.183-1.242-.167-1.425-.769-.182-.602.167-1.242.769-1.425 4.314-1.309 11.451-1.055 15.986 1.636.541.321.716 1.02.395 1.561-.322.541-1.02.716-1.561.395l-.013.005z" />
                  </svg>
                </div>
                <div className="relative z-10">
                  <div className="flex justify-between items-start mb-10">
                    <div>
                      <h3 className="text-2xl font-black tracking-tight">Spotify</h3>
                      <p className="text-xs font-bold opacity-80 mt-1">Music Streaming</p>
                    </div>
                    <div className="w-12 h-12 bg-white/5 rounded-2xl flex items-center justify-center border border-white/10">
                      <span className="material-icons-round text-slate-500">add_link</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="px-6 py-2.5 bg-white text-spotify text-[11px] font-black uppercase tracking-widest rounded-full flex items-center">
                      Connect
                      <span className="material-icons-round text-xs ml-2">arrow_forward_ios</span>
                    </span>
                    <span className="text-[10px] font-bold opacity-40">Setup required</span>
                  </div>
                </div>
              </a>
            )}

            {/* TIDAL Card */}
            {status.tidalConnected ? (
              <div className="group relative overflow-hidden bg-card-dark rounded-[32px] p-6 text-white shadow-xl border border-tidal/30">
                <div className="absolute -bottom-10 -right-6 opacity-20">
                  <svg className="w-32 h-32 fill-tidal" viewBox="0 0 24 24">
                    <path d="M12.012 5.448l3.429 3.446 3.428-3.446-3.428-3.448-3.429 3.448zm-4.568 4.594l3.428 3.447 3.429-3.447-3.429-3.448-3.428 3.448zm0-9.192L4.014 4.298l3.43 3.448 3.428-3.448-3.43-3.448zM4.014 8.896L.585 12.343l3.429 3.447 3.43-3.447-3.43-3.447zm3.43 8.044l3.428 3.446 3.429-3.446-3.429-3.448-3.428 3.448zm4.568-4.595l3.429 3.447 3.428-3.447-3.428-3.448-3.429 3.448zm4.569 4.595l3.428 3.446 3.429-3.446-3.429-3.448-3.428 3.448zm3.428-8.044l-3.428 3.447 3.428 3.447 3.429-3.447-3.429-3.447z" />
                  </svg>
                </div>
                <div className="relative z-10">
                  <div className="flex justify-between items-start mb-10">
                    <div>
                      <h3 className="text-2xl font-black tracking-tight">TIDAL</h3>
                      <p className="text-xs font-bold opacity-80 mt-1">High Fidelity Audio</p>
                    </div>
                    <div className="w-12 h-12 bg-tidal/20 backdrop-blur-md rounded-2xl flex items-center justify-center">
                      <span className="material-icons-round text-tidal">check_circle</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="px-4 py-2 bg-tidal text-black text-[11px] font-black uppercase tracking-widest rounded-full">
                      Connected
                    </span>
                    <span className="text-[10px] font-bold opacity-60">Last synced just now</span>
                  </div>
                </div>
              </div>
            ) : (
              <a
                href="/api/auth/tidal/start"
                onClick={(e) => handleConnectClick(e, "/api/auth/tidal/start")}
                className="group relative overflow-hidden bg-slate-900 dark:bg-card-dark rounded-[32px] p-6 text-white shadow-xl border border-white/5 transition-all duration-300 active:scale-95 block"
              >
                <div className="absolute -bottom-10 -right-6 opacity-20">
                  <svg className="w-32 h-32 fill-tidal" viewBox="0 0 24 24">
                    <path d="M12.012 5.448l3.429 3.446 3.428-3.446-3.428-3.448-3.429 3.448zm-4.568 4.594l3.428 3.447 3.429-3.447-3.429-3.448-3.428 3.448zm0-9.192L4.014 4.298l3.43 3.448 3.428-3.448-3.43-3.448zM4.014 8.896L.585 12.343l3.429 3.447 3.43-3.447-3.43-3.447zm3.43 8.044l3.428 3.446 3.429-3.446-3.429-3.448-3.428 3.448zm4.568-4.595l3.429 3.447 3.428-3.447-3.428-3.448-3.429 3.448zm4.569 4.595l3.428 3.446 3.429-3.446-3.429-3.448-3.428 3.448zm3.428-8.044l-3.428 3.447 3.428 3.447 3.429-3.447-3.429-3.447z" />
                  </svg>
                </div>
                <div className="relative z-10">
                  <div className="flex justify-between items-start mb-10">
                    <div>
                      <h3 className="text-2xl font-black tracking-tight">TIDAL</h3>
                      <p className="text-xs font-bold opacity-50 mt-1">High Fidelity Audio</p>
                    </div>
                    <div className="w-12 h-12 bg-white/5 rounded-2xl flex items-center justify-center border border-white/10">
                      <span className="material-icons-round text-slate-500">add_link</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="px-6 py-2.5 bg-tidal text-black text-[11px] font-black uppercase tracking-widest rounded-full flex items-center group-hover:bg-white transition-colors">
                      Connect
                      <span className="material-icons-round text-xs ml-2">arrow_forward_ios</span>
                    </span>
                    <span className="text-[10px] font-bold opacity-40">Setup required</span>
                  </div>
                </div>
              </a>
            )}
          </div>

          {/* Footer */}
          <div className="mt-8 pb-10 flex flex-col items-center">
            {bothConnected ? (
              <Link
                href="/select-sources"
                className="w-full py-5 bg-primary text-slate-900 font-extrabold text-lg rounded-[28px] shadow-lg shadow-primary/20 flex items-center justify-center space-x-2"
              >
                <span>Start Transfer</span>
                <span className="material-icons-round">shuffle</span>
              </Link>
            ) : (
              <button
                className="w-full py-5 bg-primary text-slate-900 font-extrabold text-lg rounded-[28px] shadow-lg shadow-primary/20 flex items-center justify-center space-x-2 disabled:opacity-50 disabled:grayscale"
                disabled
              >
                <span>Start Transfer</span>
                <span className="material-icons-round">shuffle</span>
              </button>
            )}
            <p className="mt-4 text-[11px] font-bold text-slate-400 uppercase tracking-widest">
              Secured by OAuth 2.0 + PKCE
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
