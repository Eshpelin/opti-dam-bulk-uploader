import { NextResponse } from "next/server";
import { getUploadUrl } from "@/lib/cmp-client";

export async function GET() {
  try {
    const data = await getUploadUrl();
    return NextResponse.json(data);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to get upload URL";
    const status = (err as { statusCode?: number }).statusCode ?? 500;
    return NextResponse.json({ error: message }, { status });
  }
}
