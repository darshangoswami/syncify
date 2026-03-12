import type { OAuthProvider, OAuthProviderAdapter } from "@syncify/shared";
import { getAppBaseUrl, normalizeBaseUrl } from "@/lib/env";
import { spotifyAdapter } from "@/lib/providers/spotify-adapter";
import { tidalAdapter } from "@/lib/providers/tidal-adapter";

const adapters: Record<OAuthProvider, OAuthProviderAdapter> = {
  spotify: spotifyAdapter,
  tidal: tidalAdapter
};

export function isOAuthProvider(value: string): value is OAuthProvider {
  return value === "spotify" || value === "tidal";
}

export function getOAuthProviderAdapter(provider: OAuthProvider): OAuthProviderAdapter {
  return adapters[provider];
}

function normalizeOAuthOrigin(provider: OAuthProvider, origin: string): string {
  const url = new URL(origin);

  // OAuth providers can reject localhost callbacks; prefer loopback IP literal in local dev.
  if ((provider === "spotify" || provider === "tidal") && (url.hostname === "localhost" || url.hostname === "[::1]")) {
    url.hostname = "127.0.0.1";
  }

  return normalizeBaseUrl(url.toString());
}

export function getOAuthCallbackUrl(provider: OAuthProvider, requestOrigin?: string): string {
  const baseUrl = requestOrigin ? requestOrigin : getAppBaseUrl();
  const normalizedBaseUrl = normalizeOAuthOrigin(provider, baseUrl);
  return new URL(`/api/auth/${provider}/callback`, normalizedBaseUrl).toString();
}
