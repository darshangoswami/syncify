import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getApprovalCookieName, readApprovalCookieValue } from "@/lib/approval-cookie";
import { getApprovalCookieSecret, getApprovedEmails } from "@/lib/env";
import { isApprovedEmail } from "@/lib/invite";

function getApprovedEmailFromRequest(request: NextRequest): string | null {
  const cookieValue = request.cookies.get(getApprovalCookieName())?.value;
  if (!cookieValue) {
    return null;
  }

  const email = readApprovalCookieValue(cookieValue, getApprovalCookieSecret());
  if (!email) {
    return null;
  }

  if (!isApprovedEmail(email, getApprovedEmails())) {
    return null;
  }

  return email;
}

export function requireApprovedEmail(request: NextRequest):
  | { ok: true; approvedEmail: string }
  | { ok: false; response: NextResponse } {
  const approvedEmail = getApprovedEmailFromRequest(request);

  if (!approvedEmail) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          error: "Approval required before auth or transfer."
        },
        { status: 403 }
      )
    };
  }

  return { ok: true, approvedEmail };
}
