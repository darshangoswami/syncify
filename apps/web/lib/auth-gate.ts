import type { OAuthProvider } from "@spotify-xyz/shared";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getApprovalCookieName, readApprovalCookieValue } from "@/lib/approval-cookie";
import { getApprovalCookieSecret, getApprovedEmails, getOAuthSessionSecret } from "@/lib/env";
import { isApprovedEmail } from "@/lib/invite";
import {
  getProviderSessionCookieName,
  readProviderSessionCookieValue,
  type ProviderSession
} from "@/lib/provider-session";

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

export function requireProviderSession(
  request: NextRequest,
  provider: OAuthProvider
):
  | { ok: true; session: ProviderSession }
  | { ok: false; response: NextResponse } {
  const cookieValue = request.cookies.get(getProviderSessionCookieName(provider))?.value;
  if (!cookieValue) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          error: `OAuth session required for provider: ${provider}.`
        },
        { status: 401 }
      )
    };
  }

  const session = readProviderSessionCookieValue(cookieValue, getOAuthSessionSecret());
  if (!session || session.provider !== provider) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          error: `OAuth session invalid for provider: ${provider}.`
        },
        { status: 401 }
      )
    };
  }

  if (session.expiresAt <= Date.now()) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          error: `OAuth session expired for provider: ${provider}.`
        },
        { status: 401 }
      )
    };
  }

  return { ok: true, session };
}
