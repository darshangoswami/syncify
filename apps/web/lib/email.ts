import { getEmailFrom, getEmailProvider, getEmailProviderApiKey, getInviteAdminEmail } from "@/lib/env";

export interface InviteEmailPayload {
  requestId: string;
  requesterEmail: string;
  sourceIp: string;
  requestedAtIso: string;
}

function buildSubject(payload: InviteEmailPayload): string {
  return `[Spotify XYZ] Invite request ${payload.requesterEmail}`;
}

function buildText(payload: InviteEmailPayload): string {
  return [
    "New invite request received.",
    "",
    `Request ID: ${payload.requestId}`,
    `Email: ${payload.requesterEmail}`,
    `IP: ${payload.sourceIp}`,
    `Requested At: ${payload.requestedAtIso}`,
    "",
    "Action:",
    "1) Add this email to Spotify dev allowlist.",
    "2) Add this email to APPROVED_EMAILS env var.",
    ""
  ].join("\n");
}

async function sendViaResend(payload: InviteEmailPayload): Promise<void> {
  const apiKey = getEmailProviderApiKey();
  const to = getInviteAdminEmail();

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from: getEmailFrom(),
      to,
      subject: buildSubject(payload),
      text: buildText(payload)
    })
  });

  if (!response.ok) {
    throw new Error(`Resend request failed with status ${response.status}`);
  }
}

async function sendViaPostmark(payload: InviteEmailPayload): Promise<void> {
  const apiKey = getEmailProviderApiKey();
  const to = getInviteAdminEmail();

  const response = await fetch("https://api.postmarkapp.com/email", {
    method: "POST",
    headers: {
      "X-Postmark-Server-Token": apiKey,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      From: getEmailFrom(),
      To: to,
      Subject: buildSubject(payload),
      TextBody: buildText(payload)
    })
  });

  if (!response.ok) {
    throw new Error(`Postmark request failed with status ${response.status}`);
  }
}

export async function sendInviteEmail(payload: InviteEmailPayload): Promise<void> {
  const provider = getEmailProvider();

  if (provider === "mock") {
    return;
  }

  if (!getInviteAdminEmail() || !getEmailProviderApiKey()) {
    throw new Error("Email provider config missing");
  }

  if (provider === "resend") {
    await sendViaResend(payload);
    return;
  }

  await sendViaPostmark(payload);
}
