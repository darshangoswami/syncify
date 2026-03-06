import { randomUUID } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import type { InviteRequestPayload, InviteRequestResult } from "@spotify-xyz/shared";
import { getBlockedDomains } from "@/lib/env";
import { sendInviteEmail } from "@/lib/email";
import { normalizeEmail, isBlockedDomain, isValidEmail } from "@/lib/invite";
import { logInviteEvent } from "@/lib/logging";
import { getClientIp } from "@/lib/request";
import { isRateLimited } from "@/lib/rate-limit";
import { ensureMinimumDuration } from "@/lib/security";

const payloadSchema = z.object({
  email: z.string().min(3),
  honeypot: z.string().optional()
});

function responseBody(requestId: string): InviteRequestResult {
  return {
    requestId,
    status: "received"
  };
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const startedAt = Date.now();
  const requestId = randomUUID();

  let parsedPayload: InviteRequestPayload;
  try {
    parsedPayload = payloadSchema.parse(await request.json());
  } catch {
    await ensureMinimumDuration(startedAt);
    return NextResponse.json({ error: "Invalid request payload." }, { status: 400 });
  }

  if (parsedPayload.honeypot?.trim()) {
    await ensureMinimumDuration(startedAt);
    logInviteEvent({ requestId, status: "filtered" });
    return NextResponse.json(responseBody(requestId), { status: 202 });
  }

  const normalizedEmail = normalizeEmail(parsedPayload.email);
  if (!isValidEmail(normalizedEmail) || isBlockedDomain(normalizedEmail, getBlockedDomains())) {
    await ensureMinimumDuration(startedAt);
    return NextResponse.json({ error: "Invalid email." }, { status: 400 });
  }

  const sourceIp = getClientIp(request);
  if (isRateLimited(`invite:ip:${sourceIp}`) || isRateLimited(`invite:email:${normalizedEmail}`)) {
    await ensureMinimumDuration(startedAt);
    logInviteEvent({ requestId, status: "rate-limited" });
    return NextResponse.json({ error: "Unable to process request right now." }, { status: 429 });
  }

  try {
    await sendInviteEmail({
      requestId,
      requesterEmail: normalizedEmail,
      sourceIp,
      requestedAtIso: new Date().toISOString()
    });
  } catch {
    logInviteEvent({ requestId, status: "delivery-failed" });
    await ensureMinimumDuration(startedAt);
    return NextResponse.json({ error: "Invite service unavailable." }, { status: 503 });
  }

  await ensureMinimumDuration(startedAt);
  logInviteEvent({ requestId, status: "received" });
  return NextResponse.json(responseBody(requestId), { status: 202 });
}
