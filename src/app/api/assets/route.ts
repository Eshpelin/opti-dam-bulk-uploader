import { NextRequest, NextResponse } from "next/server";
import { createAsset } from "@/lib/cmp-client";

export async function POST(request: NextRequest) {
  try {
    const { key, title, folderId } = await request.json();

    if (!key || !title) {
      return NextResponse.json(
        { error: "key and title are required" },
        { status: 400 }
      );
    }

    const data = await createAsset(key, title, folderId);
    return NextResponse.json(data);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to create asset";
    const status = (err as { statusCode?: number }).statusCode ?? 500;
    return NextResponse.json({ error: message }, { status });
  }
}
