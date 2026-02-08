import { NextResponse, type NextRequest } from "next/server";
import { requireApprovedEmail } from "@/lib/auth-gate";

const supportedProviders = new Set(["spotify", "tidal"]);

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ provider: string }> }
): Promise<NextResponse> {
  const approval = requireApprovedEmail(request);
  if (!approval.ok) {
    return approval.response;
  }

  const { provider } = await context.params;
  if (!supportedProviders.has(provider)) {
    return NextResponse.json({ error: "Unsupported provider." }, { status: 404 });
  }

  return NextResponse.json({
    provider,
    ok: true,
    message: "Approved. OAuth flow placeholder endpoint is ready."
  });
}
