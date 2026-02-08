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
