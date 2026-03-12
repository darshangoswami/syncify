import type {
  OAuthAuthorizationRequest,
  OAuthProviderAdapter,
  OAuthTokenExchangeRequest
} from "@syncify/shared";
import { getTidalOAuthConfig } from "@/lib/env";
import { exchangeAuthorizationCode, exchangeRefreshToken } from "@/lib/providers/oauth-client";

function requireTidalConfig(): {
  clientId: string;
  clientSecret: string;
  authorizationUrl: string;
  tokenUrl: string;
  scopes: string[];
} {
  const config = getTidalOAuthConfig();
  if (!config.clientId) {
    throw new Error("TIDAL OAuth is not configured. Missing TIDAL_CLIENT_ID.");
  }

  return config;
}

function buildAuthorizationUrl(input: OAuthAuthorizationRequest): URL {
  const config = requireTidalConfig();
  if (!input.codeChallenge) {
    throw new Error("TIDAL OAuth requires PKCE code challenge.");
  }

  const url = new URL(config.authorizationUrl);
  url.searchParams.set("client_id", config.clientId);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("redirect_uri", input.redirectUri);
  url.searchParams.set("state", input.state);
  url.searchParams.set("scope", config.scopes.join(" "));
  url.searchParams.set("code_challenge", input.codeChallenge);
  url.searchParams.set("code_challenge_method", "S256");

  return url;
}

async function exchangeCodeForToken(input: OAuthTokenExchangeRequest) {
  const config = requireTidalConfig();
  if (!input.codeVerifier) {
    throw new Error("TIDAL OAuth requires PKCE code verifier.");
  }

  return exchangeAuthorizationCode({
    tokenUrl: config.tokenUrl,
    clientId: config.clientId,
    clientSecret: config.clientSecret || undefined,
    code: input.code,
    redirectUri: input.redirectUri,
    codeVerifier: input.codeVerifier
  });
}

async function refreshAccessToken(refreshToken: string) {
  const config = requireTidalConfig();
  return exchangeRefreshToken({
    tokenUrl: config.tokenUrl,
    clientId: config.clientId,
    clientSecret: config.clientSecret || undefined,
    refreshToken
  });
}

export const tidalAdapter: OAuthProviderAdapter = {
  provider: "tidal",
  buildAuthorizationUrl,
  exchangeCodeForToken,
  refreshAccessToken
};
