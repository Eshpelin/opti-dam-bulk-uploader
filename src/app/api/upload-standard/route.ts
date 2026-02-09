import { NextRequest, NextResponse } from "next/server";
import { standardUpload } from "@/lib/cmp-client";

/**
 * Standard upload for files under 5 MB.
 * Receives the file, gets a presigned URL from CMP, uploads to S3.
 * Returns the key for asset registration.
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as Blob | null;
    const fileName = formData.get("fileName") as string | null;

    if (!file || !fileName) {
      return NextResponse.json(
        { error: "file and fileName are required" },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const key = await standardUpload(buffer, fileName);

    return NextResponse.json({ key });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Standard upload failed";
    const status = (err as { statusCode?: number }).statusCode ?? 500;
    return NextResponse.json({ error: message }, { status });
  }
}
