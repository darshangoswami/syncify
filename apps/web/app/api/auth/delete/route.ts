import { NextResponse } from "next/server";
import { getApprovalCookieName } from "@/lib/approval-cookie";
import { getProviderSessionCookieName } from "@/lib/provider-session";

export async function POST(): Promise<NextResponse> {
  const response = NextResponse.json({ cleared: true });

  const cookieNames = [
    getApprovalCookieName(),
    getProviderSessionCookieName("spotify"),
    getProviderSessionCookieName("tidal"),
  ];

  for (const name of cookieNames) {
    response.cookies.delete(name);
  }

  return response;
}
