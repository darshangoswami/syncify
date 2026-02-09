import { NextResponse, type NextRequest } from "next/server";
import { getApprovalCookieName, readApprovalCookieValue } from "@/lib/approval-cookie";
import { getApprovalCookieSecret, getApprovedEmails, getOAuthSessionSecret } from "@/lib/env";
import { isApprovedEmail } from "@/lib/invite";
import { getProviderSessionCookieName, readProviderSessionCookieValue } from "@/lib/provider-session";

export async function GET(request: NextRequest): Promise<NextResponse> {
  let approved = false;
  const approvalCookie = request.cookies.get(getApprovalCookieName())?.value;
  if (approvalCookie) {
    const email = readApprovalCookieValue(approvalCookie, getApprovalCookieSecret());
    if (email && isApprovedEmail(email, getApprovedEmails())) {
      approved = true;
    }
  }

  let spotifyConnected = false;
  const spotifyCookie = request.cookies.get(getProviderSessionCookieName("spotify"))?.value;
  if (spotifyCookie) {
    const session = readProviderSessionCookieValue(spotifyCookie, getOAuthSessionSecret());
    spotifyConnected = session !== null && session.expiresAt > Date.now();
  }

  let tidalConnected = false;
  const tidalCookie = request.cookies.get(getProviderSessionCookieName("tidal"))?.value;
  if (tidalCookie) {
    const session = readProviderSessionCookieValue(tidalCookie, getOAuthSessionSecret());
    tidalConnected = session !== null && session.expiresAt > Date.now();
  }

  return NextResponse.json({ approved, spotifyConnected, tidalConnected });
}
