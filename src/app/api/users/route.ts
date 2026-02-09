import { NextResponse } from "next/server";
import { getAllUsers } from "@/lib/cmp-client";

export async function GET() {
  try {
    const users = await getAllUsers();
    return NextResponse.json({ users });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to fetch users";
    const status = (err as { statusCode?: number }).statusCode ?? 500;
    return NextResponse.json({ error: message }, { status });
  }
}
