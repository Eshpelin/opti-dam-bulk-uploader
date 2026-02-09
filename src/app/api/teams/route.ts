import { NextResponse } from "next/server";
import { getAllTeams } from "@/lib/cmp-client";

export async function GET() {
  try {
    const teams = await getAllTeams();
    return NextResponse.json({ teams });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to fetch teams";
    const status = (err as { statusCode?: number }).statusCode ?? 500;
    return NextResponse.json({ error: message }, { status });
  }
}
