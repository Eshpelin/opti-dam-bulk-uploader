/**
 * Dynamic part size calculation for multipart uploads.
 *
 * Constraints from the CMP API:
 * - Min part size: 5 MB (5,242,880 bytes)
 * - Max part size: 5 GB (5,368,709,120 bytes)
 * - Max parts: 10,000
 * - Min file size: 1 byte
 * - Max file size: 5 TB (5,497,558,138,880 bytes)
 */

const MIN_PART_SIZE = 5 * 1024 * 1024; // 5 MB
const MAX_PART_SIZE = 5 * 1024 * 1024 * 1024; // 5 GB
const MAX_PARTS = 10_000;
const MB = 1024 * 1024;

/** Threshold below which we use the standard (non-multipart) upload path */
export const MULTIPART_THRESHOLD = 5 * MB; // 5 MB

export function calculatePartSize(fileSize: number): number {
  if (fileSize <= 0) {
    return MIN_PART_SIZE;
  }

  // Calculate the minimum part size needed to stay under 10,000 parts
  let partSize = Math.ceil(fileSize / MAX_PARTS);

  // Enforce minimum
  partSize = Math.max(partSize, MIN_PART_SIZE);

  // Round up to nearest MB for cleanliness
  partSize = Math.ceil(partSize / MB) * MB;

  // Enforce maximum
  partSize = Math.min(partSize, MAX_PART_SIZE);

  // Safety check: verify we stay under the part count limit
  const partCount = Math.ceil(fileSize / partSize);
  if (partCount > MAX_PARTS) {
    // This should not happen given the math above, but guard anyway
    partSize = Math.ceil(fileSize / MAX_PARTS);
    partSize = Math.ceil(partSize / MB) * MB;
  }

  return partSize;
}

export function calculatePartCount(
  fileSize: number,
  partSize: number
): number {
  return Math.ceil(fileSize / partSize);
}

export interface UploadEstimate {
  partSize: number;
  partCount: number;
  estimatedSeconds: number;
  exceedsUrlExpiry: boolean;
}

/**
 * Estimate upload duration and check if it exceeds the 60-minute presigned URL window.
 *
 * @param fileSize - Total file size in bytes
 * @param parallelChunks - Number of parallel chunk uploads
 * @param bytesPerSecond - Estimated upload throughput per connection in bytes/sec.
 *   Default 6.25 MB/s (50 Mbps).
 */
export function estimateUpload(
  fileSize: number,
  parallelChunks: number = 4,
  bytesPerSecond: number = 6.25 * MB
): UploadEstimate {
  const partSize = calculatePartSize(fileSize);
  const partCount = calculatePartCount(fileSize, partSize);

  // Each chunk takes partSize / bytesPerSecond seconds.
  // With parallelChunks concurrent, effective throughput scales linearly.
  const effectiveThroughput = bytesPerSecond * parallelChunks;
  const estimatedSeconds = fileSize / effectiveThroughput;

  // Presigned URLs expire in 60 minutes. Use 55-minute buffer.
  const exceedsUrlExpiry = estimatedSeconds > 55 * 60;

  return {
    partSize,
    partCount,
    estimatedSeconds,
    exceedsUrlExpiry,
  };
}

/**
 * Format bytes into a human-readable string.
 */
export function formatBytes(bytes: number, decimals = 1): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const value = bytes / Math.pow(k, i);
  return `${value.toFixed(decimals)} ${sizes[i]}`;
}

/**
 * Format seconds into a human-readable duration.
 */
export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  if (seconds < 3600) {
    const m = Math.floor(seconds / 60);
    const s = Math.round(seconds % 60);
    return `${m}m ${s}s`;
  }
  const h = Math.floor(seconds / 3600);
  const m = Math.round((seconds % 3600) / 60);
  return `${h}h ${m}m`;
}
