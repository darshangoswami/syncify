import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import type { InviteApprovalStatus } from "@spotify-xyz/shared";
import { createApprovalCookieValue, getApprovalCookieMaxAge, getApprovalCookieName } from "@/lib/approval-cookie";
import { getApprovalCookieSecret, getApprovedEmails } from "@/lib/env";
import { isApprovedEmail, isValidEmail, normalizeEmail } from "@/lib/invite";

const payloadSchema = z.object({
  email: z.string().min(3)
});

export async function POST(request: NextRequest): Promise<NextResponse> {
  let rawEmail = "";
  try {
    rawEmail = payloadSchema.parse(await request.json()).email;
  } catch {
    return NextResponse.json({ error: "Invalid request payload." }, { status: 400 });
  }

  const normalizedEmail = normalizeEmail(rawEmail);
  if (!isValidEmail(normalizedEmail)) {
    return NextResponse.json({ error: "Invalid email." }, { status: 400 });
  }

  const approved = isApprovedEmail(normalizedEmail, getApprovedEmails());

  const body: InviteApprovalStatus = {
    approved,
    normalizedEmail
  };

  const response = NextResponse.json(body, { status: 200 });
  if (!approved) {
    response.cookies.delete(getApprovalCookieName());
    return response;
  }

  response.cookies.set({
    name: getApprovalCookieName(),
    value: createApprovalCookieValue(normalizedEmail, getApprovalCookieSecret()),
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: getApprovalCookieMaxAge()
  });

  return response;
}
