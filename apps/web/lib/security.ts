export async function ensureMinimumDuration(startTime: number, minDurationMs = 250): Promise<void> {
  const elapsed = Date.now() - startTime;
  if (elapsed >= minDurationMs) {
    return;
  }

  const delay = minDurationMs - elapsed;
  await new Promise((resolve) => setTimeout(resolve, delay));
}
