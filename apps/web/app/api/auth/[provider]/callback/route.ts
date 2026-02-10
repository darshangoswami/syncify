import { NextResponse, type NextRequest } from "next/server";
import { requireApprovedEmail } from "@/lib/auth-gate";
import { getOAuthSessionSecret, getOAuthStateSecret } from "@/lib/env";
import { logApiEvent, logApiError } from "@/lib/logging";
import { isMatchingOAuthState, getOAuthStateCookieName, readOAuthStateCookieValue } from "@/lib/oauth-state";
import {
  createProviderSession,
  createProviderSessionCookieValue,
  getProviderSessionCookieMaxAge,
  getProviderSessionCookieName
} from "@/lib/provider-session";
import { getOAuthCallbackUrl, getOAuthProviderAdapter, isOAuthProvider } from "@/lib/providers";
import { OAuthTokenExchangeError } from "@/lib/providers/oauth-client";
import { getRequestId } from "@/lib/request";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ provider: string }> }
): Promise<NextResponse> {
  const requestId = getRequestId(request);

  const approval = requireApprovedEmail(request);
  if (!approval.ok) {
    return approval.response;
  }

  const { provider } = await context.params;
  if (!isOAuthProvider(provider)) {
    return NextResponse.json({ error: "Unsupported provider." }, { status: 404 });
  }

  const params = request.nextUrl.searchParams;
  const oauthError = params.get("error");
  if (oauthError) {
    logApiError({ requestId, method: "GET", path: `/api/auth/${provider}/callback`, kind: "oauth_callback", error: `Provider denied: ${oauthError}` });
    return NextResponse.json({ error: "OAuth provider denied authorization." }, { status: 400 });
  }

  const code = params.get("code");
  const state = params.get("state");
  if (!code || !state) {
    return NextResponse.json({ error: "Missing OAuth code or state." }, { status: 400 });
  }

  const stateCookieName = getOAuthStateCookieName(provider);
  const stateCookie = request.cookies.get(stateCookieName)?.value;
  if (!stateCookie) {
    return NextResponse.json({ error: "OAuth state was not found." }, { status: 400 });
  }

  const pendingState = readOAuthStateCookieValue(stateCookie, getOAuthStateSecret());
  if (
    !pendingState ||
    pendingState.provider !== provider ||
    !isMatchingOAuthState(pendingState.state, state) ||
    pendingState.approvedEmail !== approval.approvedEmail
  ) {
    logApiError({ requestId, method: "GET", path: `/api/auth/${provider}/callback`, kind: "oauth_callback", error: "State validation failed" });
    return NextResponse.json({ error: "OAuth state validation failed." }, { status: 400 });
  }

  if (provider === "tidal" && !pendingState.codeVerifier) {
    return NextResponse.json({ error: "OAuth PKCE verifier was not found." }, { status: 400 });
  }

  try {
    const tokenSet = await getOAuthProviderAdapter(provider).exchangeCodeForToken({
      code,
      redirectUri: getOAuthCallbackUrl(provider, request.nextUrl.origin),
      codeVerifier: pendingState.codeVerifier
    });
    const session = createProviderSession(provider, tokenSet);

    const response = NextResponse.redirect(new URL("/connections", request.nextUrl.origin));
    response.cookies.set({
      name: getProviderSessionCookieName(provider),
      value: createProviderSessionCookieValue(session, getOAuthSessionSecret()),
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: getProviderSessionCookieMaxAge(session)
    });
    response.cookies.delete(stateCookieName);

    logApiEvent({
      requestId, method: "GET", path: `/api/auth/${provider}/callback`, status: 302,
      durationMs: 0, kind: "oauth_callback",
      detail: `provider=${provider} success=true`
    });

    return response;
  } catch (error) {
    if (error instanceof OAuthTokenExchangeError) {
      logApiError({ requestId, method: "GET", path: `/api/auth/${provider}/callback`, kind: "oauth_callback", error: "Token exchange failed" });
      return NextResponse.json({ error: "OAuth token exchange failed." }, { status: 502 });
    }

    logApiError({ requestId, method: "GET", path: `/api/auth/${provider}/callback`, kind: "oauth_callback", error: error instanceof Error ? error.message : "Provider not configured" });
    return NextResponse.json({ error: "OAuth provider is not configured." }, { status: 503 });
  }
}
