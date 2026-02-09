"use client";

import { useUploadStore } from "@/stores/upload-store";
import {
  calculatePartSize,
  MULTIPART_THRESHOLD,
  estimateUpload,
} from "./part-size-calculator";
import type { UploadFile, MultipartUploadResponse } from "@/types";

let isRunning = false;
let activeUploads = 0;

/**
 * Start processing the upload queue.
 * Call this when the user clicks "Start Upload".
 */
export function startOrchestrator() {
  const store = useUploadStore.getState();
  store.setIsUploading(true);
  store.setIsPaused(false);

  if (!isRunning) {
    isRunning = true;
    processQueue();
  }
}

export function pauseOrchestrator() {
  useUploadStore.getState().setIsPaused(true);
}

export function stopOrchestrator() {
  isRunning = false;
  useUploadStore.getState().setIsUploading(false);
  useUploadStore.getState().setIsPaused(false);
}

function processQueue() {
  if (!isRunning) return;

  const store = useUploadStore.getState();
  if (store.isPaused) {
    setTimeout(processQueue, 500);
    return;
  }

  const maxSlots = store.maxParallelSlots;
  const availableSlots = maxSlots - activeUploads;
  if (availableSlots <= 0) {
    setTimeout(processQueue, 200);
    return;
  }

  // Find queued files
  const queuedFiles: UploadFile[] = [];
  for (const id of store.fileOrder) {
    const file = store.files.get(id);
    if (file && file.status === "queued") {
      queuedFiles.push(file);
    }
  }

  if (queuedFiles.length === 0 && activeUploads === 0) {
    isRunning = false;
    store.setIsUploading(false);
    store.addLog("info", "All uploads completed");
    return;
  }

  // Pick files to start (up to available slots)
  const toStart = queuedFiles.slice(0, availableSlots);
  for (const file of toStart) {
    activeUploads++;
    uploadFile(file).finally(() => {
      activeUploads--;
      // Continue processing queue
      setTimeout(processQueue, 100);
    });
  }

  // Check again later for more work
  if (queuedFiles.length > toStart.length) {
    setTimeout(processQueue, 500);
  }
}

async function uploadFile(file: UploadFile) {
  const store = useUploadStore.getState();

  store.setFileStatus(file.id, "uploading", {
    startedAt: Date.now(),
  });
  store.addLog("info", `Starting upload`, file.name);

  try {
    let key: string;

    // Determine effective file size (probe URL if unknown)
    let effectiveSize = file.size;
    if (effectiveSize === 0 && file.source === "url") {
      try {
        const headRes = await fetch(file.sourcePath, { method: "HEAD" });
        const cl = headRes.headers.get("content-length");
        if (cl) {
          effectiveSize = parseInt(cl, 10);
          store.updateFileProgress(file.id, { size: effectiveSize });
        }
      } catch {
        // HEAD failed, proceed with standard upload as fallback
      }
    }

    if (effectiveSize > 0 && effectiveSize < MULTIPART_THRESHOLD) {
      key = await doStandardUpload(file);
    } else if (effectiveSize === 0) {
      // Size still unknown: use standard upload and let the backend handle it
      key = await doStandardUpload(file);
    } else {
      key = await doMultipartUpload(file);
    }

    // Register the asset in CMP
    store.setFileStatus(file.id, "registering", { cmpKey: key });
    store.addLog("info", `Registering asset in CMP`, file.name);

    const selectedFolderId = useUploadStore.getState().selectedFolderId;
    const assetResponse = await fetch("/api/assets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        key,
        title: file.name,
        folderId: selectedFolderId,
      }),
    });

    if (!assetResponse.ok) {
      const errData = await assetResponse.json();
      throw new Error(errData.error || `Asset creation failed (${assetResponse.status})`);
    }

    const assetData = await assetResponse.json();

    if (!assetData.id) {
      throw new Error("Asset created but no ID returned from CMP");
    }

    store.setFileStatus(file.id, "completed", {
      assetId: assetData.id,
      progress: 100,
      completedAt: Date.now(),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown upload error";
    store.setFileStatus(file.id, "failed", {
      error: message,
      completedAt: Date.now(),
    });
  }
}

async function doStandardUpload(file: UploadFile): Promise<string> {
  const store = useUploadStore.getState();

  store.updateFileProgress(file.id, { progress: 30 });

  let response: Response;

  if (file.source === "local" && file.browserFile) {
    // Browser file: send as FormData
    const formData = new FormData();
    formData.append("file", file.browserFile);
    formData.append("fileName", file.name);
    response = await fetch("/api/upload-standard", {
      method: "POST",
      body: formData,
    });
  } else if (file.source === "path") {
    // Path file: backend reads from filesystem
    response = await fetch("/api/upload-standard", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ filePath: file.sourcePath, fileName: file.name }),
    });
  } else if (file.source === "url") {
    // URL file: backend downloads and uploads
    response = await fetch("/api/upload-standard", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fileUrl: file.sourcePath, fileName: file.name }),
    });
  } else {
    throw new Error(`Unsupported source type: ${file.source}`);
  }

  if (!response.ok) {
    const errData = await response.json();
    throw new Error(errData.error || `Standard upload failed (${response.status})`);
  }

  store.updateFileProgress(file.id, { progress: 90 });

  const data = await response.json();
  return data.key;
}

async function doMultipartUpload(file: UploadFile): Promise<string> {
  const store = useUploadStore.getState();
  const partSize = calculatePartSize(file.size);
  const estimate = estimateUpload(file.size);

  if (estimate.exceedsUrlExpiry) {
    store.addLog(
      "warn",
      `Upload may exceed 60-minute URL expiry window. Estimated time: ${Math.round(estimate.estimatedSeconds / 60)} minutes.`,
      file.name
    );
  }

  store.addLog(
    "info",
    `Initiating multipart upload: ${estimate.partCount} parts, ${formatSize(partSize)} each`,
    file.name
  );

  // Step 1: Initiate multipart upload
  const initResponse = await fetch("/api/multipart-uploads", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fileSize: file.size, partSize }),
  });

  if (!initResponse.ok) {
    const errData = await initResponse.json();
    throw new Error(errData.error || "Failed to initiate multipart upload");
  }

  const initData: MultipartUploadResponse = await initResponse.json();

  store.updateFileProgress(file.id, {
    uploadId: initData.id,
    totalChunks: initData.upload_part_count,
  });

  // Step 2: Upload chunks
  if (file.source === "path") {
    await uploadChunksFromPath(file, initData, partSize);
  } else if (file.source === "url") {
    await uploadChunksFromUrl(file, initData, partSize);
  } else {
    await uploadChunksFromBrowser(file, initData, partSize);
  }

  // Step 3: Complete the upload
  store.setFileStatus(file.id, "completing");
  store.addLog("info", `All chunks uploaded. Completing multipart upload.`, file.name);

  const completeResponse = await fetch(
    `/api/multipart-uploads/${initData.id}/complete`,
    { method: "POST" }
  );

  if (!completeResponse.ok) {
    const errData = await completeResponse.json();
    throw new Error(errData.error || "Failed to complete upload");
  }

  const completeData = await completeResponse.json();

  // Step 4: Poll for completion status
  store.addLog("info", `Waiting for server-side processing to complete`, file.name);

  let key = completeData.key;
  if (!key) {
    key = await pollForCompletion(file, initData.id);
  }

  return key;
}

async function uploadChunksFromBrowser(
  file: UploadFile,
  initData: MultipartUploadResponse,
  partSize: number
) {
  const store = useUploadStore.getState();
  const browserFile = file.browserFile;
  if (!browserFile) {
    throw new Error("No browser file available for upload");
  }

  const maxConcurrent = calculateChunkConcurrency(file);
  let completedChunks = 0;
  let bytesUploaded = 0;

  // Create chunk tasks
  const chunkTasks = initData.upload_part_urls.map((url, index) => {
    return async () => {
      const start = index * partSize;
      const end = Math.min(start + partSize, file.size);
      const slice = browserFile.slice(start, end);

      // Retry up to 3 times
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const formData = new FormData();
          formData.append("chunk", new Blob([slice]));
          formData.append("presignedUrl", url);
          formData.append("partIndex", String(index));

          const response = await fetch("/api/upload-chunk", {
            method: "POST",
            body: formData,
          });

          if (!response.ok) {
            const errData = await response.json();
            throw new Error(errData.error || `Chunk ${index} failed`);
          }

          completedChunks++;
          bytesUploaded += end - start;
          const progress = Math.round((bytesUploaded / file.size) * 95); // reserve 5% for completion

          store.updateFileProgress(file.id, {
            completedChunks,
            bytesUploaded,
            progress,
          });

          return; // success
        } catch (err) {
          if (attempt === 2) throw err;
          const delay = 1000 * Math.pow(2, attempt);
          store.addLog(
            "warn",
            `Chunk ${index + 1} failed (attempt ${attempt + 1}/3). Retrying in ${delay / 1000}s.`,
            file.name
          );
          await new Promise((r) => setTimeout(r, delay));
        }
      }
    };
  });

  // Execute with concurrency limit
  await runWithConcurrency(chunkTasks, maxConcurrent);
}

async function uploadChunksFromPath(
  file: UploadFile,
  initData: MultipartUploadResponse,
  partSize: number
) {
  const store = useUploadStore.getState();

  const response = await fetch("/api/upload-from-path", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      filePath: file.sourcePath,
      presignedUrls: initData.upload_part_urls,
      partSize,
    }),
  });

  await processSSEStream(response, file, store);
}

async function uploadChunksFromUrl(
  file: UploadFile,
  initData: MultipartUploadResponse,
  partSize: number
) {
  const store = useUploadStore.getState();

  const response = await fetch("/api/upload-from-url", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      url: file.sourcePath,
      presignedUrls: initData.upload_part_urls,
      partSize,
      totalSize: file.size,
    }),
  });

  await processSSEStream(response, file, store);
}

async function processSSEStream(
  response: Response,
  file: UploadFile,
  store: ReturnType<typeof useUploadStore.getState>
) {
  if (!response.body) {
    throw new Error("No response body from upload stream");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      const data = JSON.parse(line.slice(6));

      if (data.type === "progress") {
        const progress = Math.round(
          (data.bytesUploaded / data.totalBytes) * 95
        );
        store.updateFileProgress(file.id, {
          bytesUploaded: data.bytesUploaded,
          completedChunks: data.partIndex + 1,
          progress,
        });
      } else if (data.type === "error") {
        throw new Error(data.error);
      } else if (data.type === "complete") {
        store.updateFileProgress(file.id, {
          bytesUploaded: data.totalBytes,
          progress: 95,
        });
      }
    }
  }
}

async function pollForCompletion(
  file: UploadFile,
  uploadId: string
): Promise<string> {
  const store = useUploadStore.getState();
  const maxPollMs = 30 * 60 * 1000;
  const pollInterval = 2000;
  const startTime = Date.now();

  while (true) {
    const response = await fetch(`/api/multipart-uploads/${uploadId}/status`);
    if (!response.ok) {
      throw new Error(`Failed to get upload status (${response.status})`);
    }

    const data = await response.json();

    switch (data.status) {
      case "UPLOAD_COMPLETION_SUCCEEDED":
        if (!data.key) {
          throw new Error("Upload completed but no key returned");
        }
        return data.key;

      case "UPLOAD_COMPLETION_FAILED":
        throw new Error(`Server-side processing failed: ${data.status_message || "Unknown error"}`);

      case "UPLOAD_COMPLETION_IN_PROGRESS":
        if (Date.now() - startTime > maxPollMs) {
          throw new Error(
            "Upload completion timed out after 30 minutes. " +
            "The file may still be processing on the server. Check CMP directly."
          );
        }
        store.addLog("info", `Server processing in progress...`, file.name);
        await new Promise((r) => setTimeout(r, pollInterval));
        break;

      default:
        throw new Error(`Unexpected status: ${data.status}`);
    }
  }
}

function calculateChunkConcurrency(file: UploadFile): number {
  const store = useUploadStore.getState();
  const maxSlots = store.maxParallelSlots;

  // Count currently uploading files
  let uploadingCount = 0;
  for (const f of store.files.values()) {
    if (f.status === "uploading") uploadingCount++;
  }

  // Distribute slots: total slots / active files
  return Math.max(1, Math.floor(maxSlots / Math.max(1, uploadingCount)));
}

async function runWithConcurrency<T>(
  tasks: Array<() => Promise<T>>,
  concurrency: number
): Promise<T[]> {
  const results: T[] = [];
  let index = 0;

  async function worker() {
    while (index < tasks.length) {
      const currentIndex = index++;
      results[currentIndex] = await tasks[currentIndex]();
    }
  }

  const workers = Array.from(
    { length: Math.min(concurrency, tasks.length) },
    () => worker()
  );

  await Promise.all(workers);
  return results;
}

function formatSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}
