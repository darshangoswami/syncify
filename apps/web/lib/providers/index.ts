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

export function getOAuthCallbackUrl(provider: OAuthProvider, requestOrigin?: string): string {
  const baseUrl = requestOrigin ? normalizeOrigin(requestOrigin) : getAppBaseUrl();
  return new URL(`/api/auth/${provider}/callback`, baseUrl).toString();
}
