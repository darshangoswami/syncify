import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

function shouldCanonicalizeHostname(request: NextRequest): boolean {
  if (process.env.NODE_ENV === "production") {
    return false;
  }

  return request.nextUrl.hostname === "localhost" || request.nextUrl.hostname === "[::1]";
}

export function middleware(request: NextRequest): NextResponse {
  if (!shouldCanonicalizeHostname(request)) {
    return NextResponse.next();
  }

  const canonicalUrl = request.nextUrl.clone();
  canonicalUrl.hostname = "127.0.0.1";

  return NextResponse.redirect(canonicalUrl);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"]
};
