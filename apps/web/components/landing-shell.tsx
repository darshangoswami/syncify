"use client";

import type { FormEvent, ReactElement } from "react";
import { useMemo, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";

type NoticeTone = "success" | "warning" | "neutral";

function Notice({ tone, text }: { tone: NoticeTone; text: string }): ReactElement {
  return (
    <motion.p
      className={`notice notice-${tone}`}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
    >
      {text}
    </motion.p>
  );
}

function getReveal(index: number, reduced: boolean): {
  initial: { opacity: number; y: number };
  animate: { opacity: number; y: number };
  transition: { duration: number; delay: number; ease: [number, number, number, number] };
} {
  if (reduced) {
    return {
      initial: { opacity: 1, y: 0 },
      animate: { opacity: 1, y: 0 },
      transition: { duration: 0, delay: 0, ease: [0, 0, 1, 1] }
    };
  }

  return {
    initial: { opacity: 0, y: 16 },
    animate: { opacity: 1, y: 0 },
    transition: {
      duration: 0.42,
      delay: 0.06 * index,
      ease: [0.22, 1, 0.36, 1]
    }
  };
}

export function LandingShell(): ReactElement {
  const shouldReduceMotion = Boolean(useReducedMotion());
  const [inviteEmail, setInviteEmail] = useState("");
  const [approvedEmail, setApprovedEmail] = useState("");
  const [busyAction, setBusyAction] = useState<"invite" | "approved" | null>(null);
  const [inviteNotice, setInviteNotice] = useState<{ tone: NoticeTone; text: string } | null>(null);
  const [approvalNotice, setApprovalNotice] = useState<{ tone: NoticeTone; text: string } | null>(null);
  const [isApproved, setIsApproved] = useState(false);

  const connectHref = useMemo(() => "/api/auth/spotify/start", []);

  async function submitInvite(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const form = event.currentTarget;
    setInviteNotice(null);
    setBusyAction("invite");

    const formData = new FormData(form);
    const honeypot = String(formData.get("company") || "");

    try {
      const response = await fetch("/api/invite/request", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          email: inviteEmail,
          honeypot
        })
      });

      if (!response.ok) {
        const fallback =
          response.status === 429
            ? "Too many requests. Please try again later."
            : "Could not submit invite request.";
        setInviteNotice({ tone: "warning", text: fallback });
        return;
      }

      setInviteEmail("");
      setInviteNotice({
        tone: "success",
        text: "Request received. Once allowlisted, return and use I'm Approved."
      });
      form.reset();
    } catch {
      setInviteNotice({ tone: "warning", text: "Could not submit invite request." });
    } finally {
      setBusyAction(null);
    }
  }

  async function verifyApproval(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setApprovalNotice(null);
    setBusyAction("approved");

    try {
      const response = await fetch("/api/invite/check", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          email: approvedEmail
        })
      });

      if (!response.ok) {
        setApprovalNotice({ tone: "warning", text: "Could not verify approval." });
        return;
      }

      const payload = (await response.json()) as { approved?: boolean };
      if (payload.approved) {
        setIsApproved(true);
        setApprovalNotice({ tone: "success", text: "Approved. You can start connection now." });
        return;
      }

      setIsApproved(false);
      setApprovalNotice({
        tone: "neutral",
        text: "Still pending. Request invite first if you have not submitted your email."
      });
    } catch {
      setApprovalNotice({ tone: "warning", text: "Could not verify approval." });
    } finally {
      setBusyAction(null);
    }
  }

  const hoverLift = shouldReduceMotion ? undefined : { y: -1.5 };
  const tapShrink = shouldReduceMotion ? undefined : { scale: 0.99 };

  return (
    <main className="studio-shell">
      <motion.section className="masthead" {...getReveal(0, shouldReduceMotion)}>
        <p className="beta-pill">Private Beta</p>
        <h1>Transfer Playlists Across Services</h1>
        <p className="lead-copy">
          Clean manual onboarding for Spotify dev mode. Submit your email, get approved, then continue to
          connection.
        </p>
        <div className="policy-tags">
          <span>Manual allowlist review</span>
          <span>No persistent user DB</span>
          <span>Least-privilege OAuth</span>
        </div>
      </motion.section>

      <section className="device-grid">
        <motion.article className="phone-card" {...getReveal(1, shouldReduceMotion)}>
          <header className="phone-topbar">
            <span className="avatar-dot" aria-hidden="true" />
            <p>Invite Queue</p>
            <span className="status-orb" aria-hidden="true" />
          </header>

          <div className="art-card" aria-hidden="true">
            <div className="shape shape-a" />
            <div className="shape shape-b" />
            <div className="shape shape-c" />
          </div>

          <h2>Request Invite</h2>
          <p className="section-copy">Add your email to request manual allowlisting.</p>

          <form onSubmit={submitInvite} className="form-stack">
            <label htmlFor="invite-email">Email</label>
            <input
              id="invite-email"
              type="email"
              inputMode="email"
              autoComplete="email"
              required
              value={inviteEmail}
              onChange={(event) => setInviteEmail(event.target.value)}
              placeholder="you@example.com"
            />
            <input
              type="text"
              name="company"
              className="honeypot"
              tabIndex={-1}
              autoComplete="off"
              aria-hidden="true"
            />
            <motion.button
              type="submit"
              disabled={busyAction === "invite"}
              whileHover={hoverLift}
              whileTap={tapShrink}
            >
              {busyAction === "invite" ? "Sending..." : "Request Invite"}
            </motion.button>
          </form>

          <AnimatePresence initial={false}>
            {inviteNotice ? <Notice key={inviteNotice.text} tone={inviteNotice.tone} text={inviteNotice.text} /> : null}
          </AnimatePresence>
        </motion.article>

        <motion.article className="phone-card" {...getReveal(2, shouldReduceMotion)}>
          <header className="phone-topbar">
            <span className="ghost-chevron" aria-hidden="true">
              &#8249;
            </span>
            <p>Approval Check</p>
            <span className="menu-dots" aria-hidden="true">
              &#8942;
            </span>
          </header>

          <div className="list-preview" aria-hidden="true">
            <div className="preview-row" />
            <div className="preview-row" />
            <div className="preview-row" />
          </div>

          <h2>I&apos;m Approved</h2>
          <p className="section-copy">OAuth and transfer routes stay locked until approval is verified.</p>

          <form onSubmit={verifyApproval} className="form-stack">
            <label htmlFor="approved-email">Approved Email</label>
            <input
              id="approved-email"
              type="email"
              inputMode="email"
              autoComplete="email"
              required
              value={approvedEmail}
              onChange={(event) => setApprovedEmail(event.target.value)}
              placeholder="you@example.com"
            />
            <motion.button
              type="submit"
              disabled={busyAction === "approved"}
              whileHover={hoverLift}
              whileTap={tapShrink}
            >
              {busyAction === "approved" ? "Checking..." : "Check Approval"}
            </motion.button>
          </form>

          <AnimatePresence initial={false}>
            {approvalNotice ? (
              <Notice key={approvalNotice.text} tone={approvalNotice.tone} text={approvalNotice.text} />
            ) : null}
          </AnimatePresence>

          <motion.a
            className={`connect-link ${isApproved ? "enabled" : "disabled"}`}
            href={connectHref}
            whileHover={isApproved ? hoverLift : undefined}
            whileTap={isApproved ? tapShrink : undefined}
          >
            Start Spotify Connection
          </motion.a>
        </motion.article>
      </section>

      <motion.footer className="future-note" {...getReveal(3, shouldReduceMotion)}>
        <p className="future-eyebrow">Next Iteration</p>
        <p>AI workflow placeholder: collect invite emails and prepare approval batches for manual review.</p>
      </motion.footer>
    </main>
  );
}
