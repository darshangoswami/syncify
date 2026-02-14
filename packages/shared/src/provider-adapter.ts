export type OAuthProvider = "spotify" | "tidal";

export interface OAuthAuthorizationRequest {
  state: string;
  redirectUri: string;
  codeChallenge?: string;
}

export interface OAuthTokenExchangeRequest {
  code: string;
  redirectUri: string;
  codeVerifier?: string;
}

export interface OAuthTokenSet {
  accessToken: string;
  tokenType: string;
  scope?: string;
  expiresIn: number;
  refreshToken?: string;
}

export interface OAuthProviderAdapter {
  provider: OAuthProvider;
  buildAuthorizationUrl(input: OAuthAuthorizationRequest): URL;
  exchangeCodeForToken(input: OAuthTokenExchangeRequest): Promise<OAuthTokenSet>;
  refreshAccessToken(refreshToken: string): Promise<OAuthTokenSet>;
}
