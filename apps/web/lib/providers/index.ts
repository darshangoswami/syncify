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

export function getOAuthCallbackUrl(provider: OAuthProvider): string {
  return new URL(`/api/auth/${provider}/callback`, getAppBaseUrl()).toString();
}
