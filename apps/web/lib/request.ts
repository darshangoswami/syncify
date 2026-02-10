import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";

export function getRequestId(request: NextRequest): string {
  return request.headers.get("x-request-id") || randomUUID();
}

export function getClientIp(request: NextRequest): string {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    return forwardedFor.split(",")[0]?.trim() || "unknown";
  }

  const realIp = request.headers.get("x-real-ip");
  if (realIp) {
    return realIp;
  }

  return "unknown";
}
