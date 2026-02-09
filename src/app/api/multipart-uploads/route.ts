import { NextRequest, NextResponse } from "next/server";
import { initiateMultipartUpload } from "@/lib/cmp-client";

export async function POST(request: NextRequest) {
  try {
    const { fileSize, partSize } = await request.json();

    if (!fileSize || fileSize <= 0) {
      return NextResponse.json(
        { error: "fileSize must be a positive number" },
        { status: 400 }
      );
    }

    const data = await initiateMultipartUpload(fileSize, partSize);
    return NextResponse.json(data);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to initiate multipart upload";
    const status = (err as { statusCode?: number }).statusCode ?? 500;
    return NextResponse.json({ error: message }, { status });
  }
}
