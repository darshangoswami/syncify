import { getRateLimitMax, getRateLimitWindowSeconds } from "@/lib/env";

type TimestampMap = Map<string, number[]>;

const timestampsByKey: TimestampMap = new Map();

function prune(values: number[], threshold: number): number[] {
  return values.filter((value) => value > threshold);
}

export function isRateLimited(key: string, now = Date.now()): boolean {
  const windowMs = getRateLimitWindowSeconds() * 1000;
  const max = getRateLimitMax();
  const threshold = now - windowMs;
  const existing = timestampsByKey.get(key) ?? [];
  const recent = prune(existing, threshold);

  if (recent.length >= max) {
    timestampsByKey.set(key, recent);
    return true;
  }

  recent.push(now);
  timestampsByKey.set(key, recent);
  return false;
}

export function resetRateLimiter(): void {
  timestampsByKey.clear();
}
