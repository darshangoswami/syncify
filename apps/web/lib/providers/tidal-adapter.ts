import type {
  OAuthAuthorizationRequest,
  OAuthProviderAdapter,
  OAuthTokenExchangeRequest
} from "@spotify-xyz/shared";
import { getTidalOAuthConfig } from "@/lib/env";
import { exchangeAuthorizationCode } from "@/lib/providers/oauth-client";

function requireTidalConfig(): {
  clientId: string;
  clientSecret: string;
  authorizationUrl: string;
  tokenUrl: string;
  scopes: string[];
} {
  const config = getTidalOAuthConfig();
  if (!config.clientId || !config.clientSecret) {
    throw new Error("TIDAL OAuth is not configured. Missing TIDAL_CLIENT_ID or TIDAL_CLIENT_SECRET.");
  }

  return config;
}

function buildAuthorizationUrl(input: OAuthAuthorizationRequest): URL {
  const config = requireTidalConfig();
  const url = new URL(config.authorizationUrl);
  url.searchParams.set("client_id", config.clientId);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("redirect_uri", input.redirectUri);
  url.searchParams.set("state", input.state);
  url.searchParams.set("scope", config.scopes.join(" "));

  return url;
}

async function exchangeCodeForToken(input: OAuthTokenExchangeRequest) {
  const config = requireTidalConfig();
  return exchangeAuthorizationCode({
    tokenUrl: config.tokenUrl,
    clientId: config.clientId,
    clientSecret: config.clientSecret,
    code: input.code,
    redirectUri: input.redirectUri
  });
}

export const tidalAdapter: OAuthProviderAdapter = {
  provider: "tidal",
  buildAuthorizationUrl,
  exchangeCodeForToken
};
