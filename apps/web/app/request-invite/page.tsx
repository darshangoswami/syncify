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
    <div className="flex justify-center items-center min-h-screen">
      <div className="max-w-[400px] w-full mx-auto min-h-screen relative overflow-hidden flex flex-col bg-background-dark">
        {/* Header */}
        <div className="px-8 pt-12 pb-8">
          <div className="flex justify-between items-start mb-10">
            <Link
              href="/"
              className="w-10 h-10 flex items-center justify-center rounded-full bg-zinc-800 text-white"
            >
              <span className="material-icons-round">arrow_back</span>
            </Link>
          </div>

          <h1 className="text-4xl font-extrabold leading-tight mb-4 tracking-tight">
            Move your <br />
            music <span className="text-primary italic">freely.</span>
          </h1>
          <p className="text-zinc-400 text-lg font-medium leading-relaxed">
            Join the waitlist to transfer your library from Spotify to TIDAL in
            seconds.
          </p>
        </div>

        {/* Illustration area */}
        <div className="relative h-48 mb-8 overflow-hidden px-8">
          {/* Decorative star */}
          <div className="absolute top-0 right-10 animate-bounce" style={{ animationDuration: "3000ms" }}>
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
          <div className="absolute bottom-4 left-10 rotate-12">
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

          {/* Success illustration */}
          {status === "success" && (
            <div className="w-full h-full flex flex-col items-center justify-center text-center">
              <div className="bg-primary/20 p-6 rounded-full mb-4">
                <span className="material-icons-round text-primary text-5xl">mail_outline</span>
              </div>
              <div className="text-primary font-bold text-xl">Invitation Request Sent!</div>
            </div>
          )}

          {/* Form illustration */}
          {status !== "success" && (
            <div className="w-full h-full flex items-center justify-center">
              <div className="relative">
                <div className="w-32 h-32 bg-primary rounded-3xl rotate-6 flex items-center justify-center shadow-xl">
                  <span className="material-icons-round text-white text-6xl">queue_music</span>
                </div>
                <div className="absolute -top-4 -right-4 w-12 h-12 bg-white text-zinc-900 rounded-full flex items-center justify-center shadow-lg border-4 border-background-dark">
                  <span className="material-icons-round">bolt</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Form / Success content */}
        <div className="flex-grow px-8 pb-12">
          {status !== "success" ? (
            <form className="space-y-6" onSubmit={handleSubmit}>
              <div className="space-y-2">
                <label
                  className="text-xs font-bold uppercase tracking-widest text-zinc-500 px-1"
                  htmlFor="email"
                >
                  Email Address
                </label>
                <div className="relative">
                  <input
                    className={`w-full bg-zinc-900 border-2 ${
                      errorMessage ? "border-red-500" : "border-transparent"
                    } focus:border-primary focus:ring-0 rounded-2xl px-6 py-4 text-lg font-semibold transition-all duration-200 outline-none placeholder:opacity-30`}
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
                className="w-full bg-primary hover:bg-emerald-400 text-zinc-900 font-extrabold text-lg py-5 rounded-2xl flex items-center justify-center gap-3 transition-all active:scale-95 shadow-lg shadow-primary/20 disabled:opacity-60"
                type="submit"
                disabled={status === "submitting"}
              >
                {status === "submitting" ? "Sending..." : "Request Invite"}
                <span className="material-icons-round">arrow_forward</span>
              </button>

              <p className="text-center text-xs text-zinc-600 font-medium px-8 leading-relaxed">
                By requesting an invite, you agree to our{" "}
                <span className="underline">Terms of Service</span> and{" "}
                <span className="underline">Privacy Policy</span>.
              </p>
            </form>
          ) : (
            <div className="space-y-6 text-center">
              <h2 className="text-2xl font-bold">You&apos;re on the list!</h2>
              <p className="text-zinc-400">
                We&apos;ll send an invite to your email as soon as a spot opens
                up. Keep an eye on your inbox.
              </p>
              <button
                className="w-full bg-zinc-900 text-white font-bold py-4 rounded-2xl transition-all active:scale-95"
                onClick={() => router.push("/")}
              >
                Go Back
              </button>
            </div>
          )}
        </div>

        {/* Wave decoration */}
        <div className="absolute bottom-0 left-0 w-full overflow-hidden leading-none z-0 pointer-events-none opacity-40">
          <svg preserveAspectRatio="none" style={{ height: "100px", width: "100%" }} viewBox="0 0 500 150">
            <path
              className="fill-primary"
              d="M0.00,49.98 C150.00,150.00 349.20,-50.00 500.00,49.98 L500.00,150.00 L0.00,150.00 Z"
            />
          </svg>
        </div>
      </div>
    </div>
  );
}
