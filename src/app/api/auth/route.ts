import { NextRequest, NextResponse } from "next/server";
import { authenticate, disconnect } from "@/lib/cmp-client";
import {
  isAuthenticated,
  getExpiresIn,
} from "@/lib/token-manager";

export async function POST(request: NextRequest) {
  try {
    const { clientId, clientSecret } = await request.json();

    if (!clientId || !clientSecret) {
      return NextResponse.json(
        { error: "clientId and clientSecret are required" },
        { status: 400 }
      );
    }

    await authenticate(clientId, clientSecret);
    return NextResponse.json({ success: true });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Authentication failed";
    return NextResponse.json({ error: message }, { status: 401 });
  }
}

export async function GET() {
  return NextResponse.json({
    authenticated: isAuthenticated(),
    expiresIn: getExpiresIn(),
  });
}

export async function DELETE() {
  disconnect();
  return NextResponse.json({ success: true });
}
