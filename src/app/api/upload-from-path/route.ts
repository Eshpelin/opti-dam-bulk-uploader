import { NextRequest } from "next/server";
import { createReadStream, statSync } from "node:fs";
import { uploadChunkToS3 } from "@/lib/cmp-client";

/**
 * Reads a file from the local filesystem and uploads chunks to S3 presigned URLs.
 * Streams progress via Server-Sent Events.
 *
 * Body JSON:
 * - filePath: absolute path to the file
 * - presignedUrls: array of S3 presigned URLs (one per chunk)
 * - partSize: size of each chunk in bytes
 */
export async function POST(request: NextRequest) {
  const { filePath, presignedUrls, partSize } = await request.json();

  if (!filePath || !presignedUrls || !partSize) {
    return new Response(
      JSON.stringify({ error: "filePath, presignedUrls, and partSize are required" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  // Verify file exists
  let fileSize: number;
  try {
    const stats = statSync(filePath);
    fileSize = stats.size;
  } catch {
    return new Response(
      JSON.stringify({ error: `File not found: ${filePath}` }),
      { status: 404, headers: { "Content-Type": "application/json" } }
    );
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const sendEvent = (data: Record<string, unknown>) => {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify(data)}\n\n`)
        );
      };

      try {
        for (let i = 0; i < presignedUrls.length; i++) {
          const start = i * partSize;
          const end = Math.min(start + partSize, fileSize);
          const chunkSize = end - start;

          // Read chunk from file
          const chunks: Buffer[] = [];
          await new Promise<void>((resolve, reject) => {
            const readStream = createReadStream(filePath, {
              start,
              end: end - 1,
            });
            readStream.on("data", (data: Buffer | string) => {
              if (Buffer.isBuffer(data)) {
                chunks.push(data);
              } else {
                chunks.push(Buffer.from(data));
              }
            });
            readStream.on("end", resolve);
            readStream.on("error", reject);
          });

          const chunkBuffer = Buffer.concat(chunks);

          // Upload with retry (3 attempts)
          let uploaded = false;
          let lastError = "";
          for (let attempt = 0; attempt < 3; attempt++) {
            try {
              await uploadChunkToS3(presignedUrls[i], chunkBuffer);
              uploaded = true;
              break;
            } catch (err) {
              lastError =
                err instanceof Error ? err.message : "Unknown error";
              if (attempt < 2) {
                const delay = 1000 * Math.pow(2, attempt);
                await new Promise((r) => setTimeout(r, delay));
              }
            }
          }

          if (!uploaded) {
            sendEvent({
              type: "error",
              partIndex: i,
              error: lastError,
            });
            controller.close();
            return;
          }

          sendEvent({
            type: "progress",
            partIndex: i,
            bytesUploaded: (i + 1) * partSize > fileSize ? fileSize : (i + 1) * partSize,
            totalBytes: fileSize,
            chunkSize,
          });
        }

        sendEvent({ type: "complete", totalBytes: fileSize });
      } catch (err) {
        sendEvent({
          type: "error",
          error: err instanceof Error ? err.message : "Unknown error",
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
