import { NextRequest, NextResponse } from "next/server";
import { standardUpload } from "@/lib/cmp-client";
import { readFileSync } from "node:fs";

/**
 * Standard upload for files under 5 MB.
 * Supports three modes.
 * 1. FormData with file blob and fileName (browser drop)
 * 2. JSON with filePath and fileName (filesystem path)
 * 3. JSON with fileUrl and fileName (URL download)
 *
 * Returns the key for asset registration.
 */
export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get("content-type") || "";

    let buffer: Buffer;
    let fileName: string;

    if (contentType.includes("multipart/form-data")) {
      // Browser file upload via FormData
      const formData = await request.formData();
      const file = formData.get("file") as Blob | null;
      const name = formData.get("fileName") as string | null;

      if (!file || !name) {
        return NextResponse.json(
          { error: "file and fileName are required" },
          { status: 400 }
        );
      }

      buffer = Buffer.from(await file.arrayBuffer());
      fileName = name;
    } else {
      // JSON body for path or URL sources
      const body = await request.json();
      fileName = body.fileName;

      if (!fileName) {
        return NextResponse.json(
          { error: "fileName is required" },
          { status: 400 }
        );
      }

      if (body.filePath) {
        // Read from filesystem
        try {
          buffer = readFileSync(body.filePath);
        } catch {
          return NextResponse.json(
            { error: `File not found: ${body.filePath}` },
            { status: 404 }
          );
        }
      } else if (body.fileUrl) {
        // Download from URL
        const downloadResponse = await fetch(body.fileUrl);
        if (!downloadResponse.ok) {
          return NextResponse.json(
            { error: `Failed to download from URL: ${downloadResponse.status}` },
            { status: 400 }
          );
        }
        buffer = Buffer.from(await downloadResponse.arrayBuffer());
      } else {
        return NextResponse.json(
          { error: "file, filePath, or fileUrl is required" },
          { status: 400 }
        );
      }
    }

    const key = await standardUpload(buffer, fileName);
    return NextResponse.json({ key });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Standard upload failed";
    const status = (err as { statusCode?: number }).statusCode ?? 500;
    return NextResponse.json({ error: message }, { status });
  }
}
