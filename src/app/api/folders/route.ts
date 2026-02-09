import { NextResponse } from "next/server";
import { getAllFolders } from "@/lib/cmp-client";

export async function GET() {
  try {
    const folders = await getAllFolders();
    return NextResponse.json({ folders });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to fetch folders";
    const status = (err as { statusCode?: number }).statusCode ?? 500;
    return NextResponse.json({ error: message }, { status });
  }
}
