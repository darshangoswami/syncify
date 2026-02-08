import { NextResponse, type NextRequest } from "next/server";
import { requireApprovedEmail } from "@/lib/auth-gate";

export async function POST(request: NextRequest): Promise<NextResponse> {
  const approval = requireApprovedEmail(request);
  if (!approval.ok) {
    return approval.response;
  }

  return NextResponse.json({
    ok: true,
    report: {
      status: "ready",
      note: "Finalize placeholder."
    }
  });
}
