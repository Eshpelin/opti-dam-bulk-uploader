import { NextRequest } from "next/server";
import { uploadChunkToS3 } from "@/lib/cmp-client";

/**
 * Downloads a file from a URL and uploads chunks to S3 presigned URLs.
 * Streams progress via Server-Sent Events.
 *
 * Backpressure: downloads one chunk at a time, uploads it, then downloads next.
 * Max memory: 1 x partSize.
 *
 * Body JSON:
 * - url: the remote URL to download from
 * - presignedUrls: array of S3 presigned URLs
 * - partSize: size of each chunk in bytes
 * - totalSize: expected total size (from previous HEAD request)
 */
export async function POST(request: NextRequest) {
  const { url, presignedUrls, partSize, totalSize } = await request.json();

  if (!url || !presignedUrls || !partSize) {
    return new Response(
      JSON.stringify({ error: "url, presignedUrls, and partSize are required" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
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
        // Start downloading the file
        const downloadResponse = await fetch(url);
        if (!downloadResponse.ok) {
          sendEvent({
            type: "error",
            error: `Download failed: HTTP ${downloadResponse.status} ${downloadResponse.statusText}`,
          });
          controller.close();
          return;
        }

        const reader = downloadResponse.body?.getReader();
        if (!reader) {
          sendEvent({ type: "error", error: "No response body from URL" });
          controller.close();
          return;
        }

        let partIndex = 0;
        let buffer = new Uint8Array(0);
        let totalBytesDownloaded = 0;

        while (true) {
          const { done, value } = await reader.read();

          if (value) {
            // Append to buffer
            const newBuffer = new Uint8Array(buffer.length + value.length);
            newBuffer.set(buffer);
            newBuffer.set(value, buffer.length);
            buffer = newBuffer;
            totalBytesDownloaded += value.length;
          }

          // Upload complete chunks from the buffer
          while (buffer.length >= partSize && partIndex < presignedUrls.length) {
            const chunk = buffer.slice(0, partSize);
            buffer = buffer.slice(partSize);

            // Upload with retry
            let uploaded = false;
            let lastError = "";
            for (let attempt = 0; attempt < 3; attempt++) {
              try {
                await uploadChunkToS3(presignedUrls[partIndex], chunk);
                uploaded = true;
                break;
              } catch (err) {
                lastError = err instanceof Error ? err.message : "Unknown error";
                if (attempt < 2) {
                  await new Promise((r) => setTimeout(r, 1000 * Math.pow(2, attempt)));
                }
              }
            }

            if (!uploaded) {
              sendEvent({ type: "error", partIndex, error: lastError });
              reader.cancel();
              controller.close();
              return;
            }

            sendEvent({
              type: "progress",
              partIndex,
              bytesUploaded: Math.min((partIndex + 1) * partSize, totalSize || totalBytesDownloaded),
              totalBytes: totalSize || totalBytesDownloaded,
              chunkSize: chunk.length,
            });

            partIndex++;
          }

          if (done) {
            // Upload any remaining data as the last chunk
            if (buffer.length > 0 && partIndex < presignedUrls.length) {
              let uploaded = false;
              let lastError = "";
              for (let attempt = 0; attempt < 3; attempt++) {
                try {
                  await uploadChunkToS3(presignedUrls[partIndex], buffer);
                  uploaded = true;
                  break;
                } catch (err) {
                  lastError = err instanceof Error ? err.message : "Unknown error";
                  if (attempt < 2) {
                    await new Promise((r) => setTimeout(r, 1000 * Math.pow(2, attempt)));
                  }
                }
              }

              if (!uploaded) {
                sendEvent({ type: "error", partIndex, error: lastError });
                controller.close();
                return;
              }

              sendEvent({
                type: "progress",
                partIndex,
                bytesUploaded: totalBytesDownloaded,
                totalBytes: totalSize || totalBytesDownloaded,
                chunkSize: buffer.length,
              });
            }

            sendEvent({
              type: "complete",
              totalBytes: totalBytesDownloaded,
            });
            break;
          }
        }
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
