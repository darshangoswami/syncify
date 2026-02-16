import { NextResponse, type NextRequest } from "next/server";
import { requireApprovedEmail, requireProviderSession } from "@/lib/auth-gate";
import { applyRefreshedSessionCookie } from "@/lib/provider-session";
import { listTidalUserPlaylists } from "@/lib/providers/tidal-catalog";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const approval = requireApprovedEmail(request);
  if (!approval.ok) {
    return approval.response;
  }

  const tidalSession = await requireProviderSession(request, "tidal");
  if (!tidalSession.ok) {
    return tidalSession.response;
  }

  const playlists = await listTidalUserPlaylists(tidalSession.session);

  const response = NextResponse.json({ ok: true, playlists });
  applyRefreshedSessionCookie(response, tidalSession);
  return response;
}
