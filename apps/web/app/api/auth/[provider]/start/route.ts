import { NextResponse, type NextRequest } from "next/server";
import { requireApprovedEmail } from "@/lib/auth-gate";
import { getOAuthStateSecret } from "@/lib/env";
import {
  createOAuthState,
  createOAuthStateCookieValue,
  getOAuthStateCookieMaxAge,
  getOAuthStateCookieName
} from "@/lib/oauth-state";
import { getOAuthCallbackUrl, getOAuthProviderAdapter, isOAuthProvider } from "@/lib/providers";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ provider: string }> }
): Promise<NextResponse> {
  const approval = requireApprovedEmail(request);
  if (!approval.ok) {
    return approval.response;
  }

  const { provider } = await context.params;
  if (!isOAuthProvider(provider)) {
    return NextResponse.json({ error: "Unsupported provider." }, { status: 404 });
  }

  const state = createOAuthState();
  const redirectUri = getOAuthCallbackUrl(provider, request.nextUrl.origin);

  try {
    const authorizationUrl = getOAuthProviderAdapter(provider).buildAuthorizationUrl({
      state,
      redirectUri
    });

    const response = NextResponse.redirect(authorizationUrl);
    response.cookies.set({
      name: getOAuthStateCookieName(provider),
      value: createOAuthStateCookieValue(provider, approval.approvedEmail, state, getOAuthStateSecret()),
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: getOAuthStateCookieMaxAge()
    });

    return response;
  } catch {
    return NextResponse.json({ error: "OAuth provider is not configured." }, { status: 503 });
  }
}
