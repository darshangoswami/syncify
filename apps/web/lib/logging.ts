export function logInviteEvent(event: {
  requestId: string;
  status: "received" | "filtered" | "rate-limited" | "delivery-failed";
}): void {
  console.info(
    JSON.stringify({
      at: new Date().toISOString(),
      kind: "invite_request",
      requestId: event.requestId,
      status: event.status
    })
  );
}

export function logApiEvent(event: {
  requestId: string;
  method: string;
  path: string;
  status: number;
  durationMs: number;
  kind: string;
  detail?: string;
}): void {
  console.info(JSON.stringify({ at: new Date().toISOString(), ...event }));
}

export function logApiError(event: {
  requestId: string;
  method: string;
  path: string;
  kind: string;
  error: string;
}): void {
  console.error(JSON.stringify({ at: new Date().toISOString(), ...event }));
}
