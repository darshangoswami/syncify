import type { ProviderSession } from "@/lib/provider-session";
import { ProviderApiError } from "@/lib/providers/errors";

export function getAuthHeader(session: ProviderSession): string {
  return `${session.tokenType || "Bearer"} ${session.accessToken}`;
}

export function getString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

export function getNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export interface TidalRetryOptions {
  throttleMs: number;
  maxRetries: number;
  retryBaseMs: number;
}

export async function tidalFetchWithRetry(
  url: string,
  session: ProviderSession,
  options: TidalRetryOptions,
  init?: RequestInit
): Promise<Response> {
  let response: Response | null = null;

  for (let attempt = 0; attempt <= options.maxRetries; attempt++) {
    if (attempt > 0) {
      await delay(options.retryBaseMs * Math.pow(2, attempt - 1));
    } else {
      await delay(options.throttleMs);
    }

    response = await fetch(url, {
      ...init,
      headers: {
        ...init?.headers,
        Authorization: getAuthHeader(session)
      }
    });

    if (response.status !== 429) break;
  }

  if (!response) {
    throw new ProviderApiError("TIDAL API request failed after retries.", 429);
  }

  return response;
}
