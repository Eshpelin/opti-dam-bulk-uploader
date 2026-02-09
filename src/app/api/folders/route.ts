import { NextRequest, NextResponse } from "next/server";
import { getAllFolders, createFolder } from "@/lib/cmp-client";

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

export async function POST(request: NextRequest) {
  try {
    const { name, parentFolderId } = await request.json();

    if (!name) {
      return NextResponse.json(
        { error: "name is required" },
        { status: 400 }
      );
    }

    const folder = await createFolder(name, parentFolderId ?? null);
    return NextResponse.json(folder);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to create folder";
    const status = (err as { statusCode?: number }).statusCode ?? 500;
    return NextResponse.json({ error: message }, { status });
  }
}
