import { NextRequest, NextResponse } from "next/server";
import { uploadChunkToS3 } from "@/lib/cmp-client";

/**
 * Receives a file chunk from the browser and PUTs it to an S3 presigned URL.
 *
 * Expects multipart/form-data with:
 * - chunk: the binary chunk data
 * - presignedUrl: the S3 presigned URL to PUT the chunk to
 * - partIndex: the zero-based part index (for tracking)
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const chunk = formData.get("chunk") as Blob | null;
    const presignedUrl = formData.get("presignedUrl") as string | null;
    const partIndex = formData.get("partIndex") as string | null;

    if (!chunk || !presignedUrl || partIndex === null) {
      return NextResponse.json(
        { error: "chunk, presignedUrl, and partIndex are required" },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await chunk.arrayBuffer());
    await uploadChunkToS3(presignedUrl, buffer);

    return NextResponse.json({
      success: true,
      partIndex: parseInt(partIndex, 10),
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Chunk upload failed";
    const status = (err as { statusCode?: number }).statusCode ?? 500;
    return NextResponse.json({ error: message }, { status });
  }
}
