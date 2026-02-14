import { z } from "zod";
import type { OAuthTokenSet } from "@spotify-xyz/shared";

const tokenResponseSchema = z.object({
  access_token: z.string().min(1),
  token_type: z.string().optional(),
  scope: z.string().optional(),
  expires_in: z.number().int().positive().optional(),
  refresh_token: z.string().optional()
});

export class OAuthTokenExchangeError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "OAuthTokenExchangeError";
    this.status = status;
  }
}

function asExpiresIn(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return Math.floor(value);
  }

  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed) && parsed > 0) {
      return Math.floor(parsed);
    }
  }

  return 3600;
}

export async function exchangeAuthorizationCode(input: {
  tokenUrl: string;
  clientId: string;
  clientSecret?: string;
  code: string;
  redirectUri: string;
  codeVerifier?: string;
}): Promise<OAuthTokenSet> {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code: input.code,
    redirect_uri: input.redirectUri,
    client_id: input.clientId
  });
  if (input.clientSecret) {
    body.set("client_secret", input.clientSecret);
  }
  if (input.codeVerifier) {
    body.set("code_verifier", input.codeVerifier);
  }

  const response = await fetch(input.tokenUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: body.toString()
  });

  let payload: unknown = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) {
    const detail =
      payload && typeof payload === "object" && "error_description" in payload
        ? String((payload as { error_description?: unknown }).error_description)
        : `status ${response.status}`;
    throw new OAuthTokenExchangeError(`OAuth token exchange failed: ${detail}`, response.status);
  }

  const parsed = tokenResponseSchema.safeParse(payload);
  if (!parsed.success) {
    throw new OAuthTokenExchangeError("OAuth token response format invalid.", 502);
  }

  return {
    accessToken: parsed.data.access_token,
    tokenType: parsed.data.token_type || "Bearer",
    scope: parsed.data.scope,
    expiresIn: asExpiresIn(parsed.data.expires_in),
    refreshToken: parsed.data.refresh_token
  };
}

export async function exchangeRefreshToken(input: {
  tokenUrl: string;
  clientId: string;
  clientSecret?: string;
  refreshToken: string;
}): Promise<OAuthTokenSet> {
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: input.refreshToken,
    client_id: input.clientId
  });
  if (input.clientSecret) {
    body.set("client_secret", input.clientSecret);
  }

  const response = await fetch(input.tokenUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: body.toString()
  });

  let payload: unknown = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) {
    const detail =
      payload && typeof payload === "object" && "error_description" in payload
        ? String((payload as { error_description?: unknown }).error_description)
        : `status ${response.status}`;
    throw new OAuthTokenExchangeError(`OAuth token refresh failed: ${detail}`, response.status);
  }

  const parsed = tokenResponseSchema.safeParse(payload);
  if (!parsed.success) {
    throw new OAuthTokenExchangeError("OAuth token refresh response format invalid.", 502);
  }

  return {
    accessToken: parsed.data.access_token,
    tokenType: parsed.data.token_type || "Bearer",
    scope: parsed.data.scope,
    expiresIn: asExpiresIn(parsed.data.expires_in),
    refreshToken: parsed.data.refresh_token || input.refreshToken
  };
}
