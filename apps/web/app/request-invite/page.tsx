"use client";

import type { FormEvent, ReactElement } from "react";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type Status = "idle" | "submitting" | "success" | "error";

export default function RequestInvitePage(): ReactElement {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [errorMessage, setErrorMessage] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setErrorMessage("");
    setStatus("submitting");

    const form = event.currentTarget;
    const formData = new FormData(form);
    const honeypot = String(formData.get("company") || "");

    try {
      const response = await fetch("/api/invite/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, honeypot })
      });

      if (!response.ok) {
        const fallback =
          response.status === 429
            ? "Too many requests. Please try again later."
            : "Could not submit invite request.";
        setErrorMessage(fallback);
        setStatus("error");
        return;
      }

      setStatus("success");
    } catch {
      setErrorMessage("Could not submit invite request.");
      setStatus("error");
    }
  }

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
            Move your<br />
            music <span className="text-primary italic font-semibold">freely.</span>
          </h1>
          <p className="text-zinc-400 text-lg md:text-xl mb-12 max-w-md">
            Join the waitlist to transfer your library from Spotify to TIDAL in
            seconds.
          </p>

          {status !== "success" ? (
            <form className="w-full max-w-md space-y-6" onSubmit={handleSubmit}>
              <div>
                <label
                  className="block text-xs font-semibold tracking-wider text-zinc-500 uppercase mb-2 ml-1"
                  htmlFor="email"
                >
                  Email Address
                </label>
                <div className="relative">
                  <input
                    className={`w-full bg-zinc-900 border-2 ${
                      errorMessage ? "border-red-500" : "border-transparent"
                    } focus:border-primary focus:ring-0 rounded-xl px-5 py-4 text-white placeholder-zinc-600 transition-all outline-none`}
                    id="email"
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    required
                    placeholder="hello@example.com"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      setErrorMessage("");
                      if (status === "error") setStatus("idle");
                    }}
                  />
                  {/* Honeypot */}
                  <input
                    type="text"
                    name="company"
                    className="honeypot"
                    tabIndex={-1}
                    autoComplete="off"
                    aria-hidden="true"
                  />
                  {errorMessage && (
                    <div className="text-red-500 text-sm mt-2 font-medium px-1 flex items-center gap-1">
                      <span className="material-icons-round text-base">error_outline</span>
                      <span>{errorMessage}</span>
                    </div>
                  )}
                </div>
              </div>

              <button
                className="w-full bg-primary hover:bg-green-500 text-black font-bold text-lg rounded-xl px-5 py-4 flex items-center justify-center gap-2 transition-all transform hover:-translate-y-1 active:scale-95 disabled:opacity-60"
                type="submit"
                disabled={status === "submitting"}
              >
                {status === "submitting" ? "Sending..." : "Request Invite"}
                <span className="material-icons-round">arrow_forward</span>
              </button>
            </form>
          ) : (
            <div className="w-full max-w-md space-y-6">
              <div className="flex items-center gap-4 mb-2">
                <div className="bg-primary/20 p-4 rounded-full">
                  <span className="material-icons-round text-primary text-4xl">mail_outline</span>
                </div>
                <div className="text-primary font-bold text-xl">Invitation Request Sent!</div>
              </div>
              <h2 className="text-2xl font-bold">You&apos;re on the list!</h2>
              <p className="text-zinc-400">
                We&apos;ll send an invite to your email as soon as a spot opens
                up. Keep an eye on your inbox.
              </p>
              <button
                className="w-full bg-zinc-900 text-white font-bold py-4 rounded-xl transition-all active:scale-95 hover:bg-zinc-800"
                onClick={() => router.push("/")}
              >
                Go Back
              </button>
            </div>
          )}
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

          {status === "success" ? (
            <div className="flex flex-col items-center justify-center text-center">
              <div className="bg-primary/20 p-6 rounded-full mb-4">
                <span className="material-icons-round text-primary text-5xl">mail_outline</span>
              </div>
              <div className="text-primary font-bold text-xl">Invitation Request Sent!</div>
            </div>
          ) : (
            <div className="relative w-80 h-80 bg-primary rounded-[2rem] -rotate-[5deg] flex items-center justify-center shadow-2xl shadow-green-900/20">
              <span className="material-icons-round text-white text-6xl">queue_music</span>
              <div className="absolute -top-4 -right-4 w-14 h-14 bg-white rounded-full flex items-center justify-center shadow-lg border-4 border-background-dark rotate-12">
                <span className="material-icons-round text-black font-bold text-2xl">bolt</span>
              </div>
            </div>
          )}
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
