import type { OAuthProvider, OAuthProviderAdapter } from "@spotify-xyz/shared";
import { getAppBaseUrl } from "@/lib/env";
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

function normalizeOrigin(value: string): string {
  return value.endsWith("/") ? value.slice(0, -1) : value;
}

function normalizeOAuthOrigin(provider: OAuthProvider, origin: string): string {
  const url = new URL(origin);

  // Spotify local development requires loopback IP literals, not localhost.
  if (provider === "spotify" && (url.hostname === "localhost" || url.hostname === "[::1]")) {
    url.hostname = "127.0.0.1";
  }

  return normalizeOrigin(url.toString());
}

export function getOAuthCallbackUrl(provider: OAuthProvider, requestOrigin?: string): string {
  const baseUrl = requestOrigin ? requestOrigin : getAppBaseUrl();
  const normalizedBaseUrl = normalizeOAuthOrigin(provider, baseUrl);
  return new URL(`/api/auth/${provider}/callback`, normalizedBaseUrl).toString();
}
