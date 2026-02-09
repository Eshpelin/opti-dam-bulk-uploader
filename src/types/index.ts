/** Source of the file to upload */
export type FileSource = "local" | "url" | "path";

/** Upload status state machine */
export type UploadStatus =
  | "queued"
  | "uploading"
  | "completing"
  | "registering"
  | "completed"
  | "failed";

/** A single file in the upload queue */
export interface UploadFile {
  id: string;
  name: string;
  source: FileSource;
  sourcePath: string; // local path, URL, or "browser-drop"
  size: number; // bytes (0 if unknown for URLs)
  status: UploadStatus;
  progress: number; // 0-100
  bytesUploaded: number;
  speed: number; // bytes per second (rolling average)
  eta: number; // seconds remaining
  assetId: string | null;
  error: string | null;
  uploadId: string | null; // CMP multipart upload ID
  cmpKey: string | null; // the key used for POST /v3/assets
  totalChunks: number;
  completedChunks: number;
  startedAt: number | null; // Unix ms
  completedAt: number | null; // Unix ms
  browserFile: File | null; // present only for drag-and-drop files
}

/** Log entry severity */
export type LogSeverity = "info" | "warn" | "error" | "success";

/** A single console log entry */
export interface LogEntry {
  id: number;
  timestamp: number; // Unix ms
  severity: LogSeverity;
  message: string;
  fileName?: string;
}

/** CMP folder from the API */
export interface CmpFolder {
  id: string;
  name: string;
  parentFolderId: string | null;
  breadcrumb: string; // computed, e.g. "Marketing > 2026 > Q1"
}

/** Response from GET /v3/upload-url */
export interface UploadUrlResponse {
  url: string;
  upload_meta_fields: Record<string, string>;
}

/** Response from POST /v3/multipart-uploads */
export interface MultipartUploadResponse {
  id: string;
  upload_part_urls: string[];
  upload_part_count: number;
  expires_at: string;
}

/** Response from GET /v3/multipart-uploads/{id}/status */
export interface MultipartStatusResponse {
  status:
    | "UPLOAD_COMPLETION_NOT_STARTED"
    | "UPLOAD_COMPLETION_IN_PROGRESS"
    | "UPLOAD_COMPLETION_SUCCEEDED"
    | "UPLOAD_COMPLETION_FAILED";
  key?: string;
  status_message?: string;
}

/** Response from POST /v3/assets */
export interface CreateAssetResponse {
  id: string;
  links: {
    self: string;
  };
}

/** Response from POST /v3/multipart-uploads/{id}/complete */
export interface CompleteUploadResponse {
  key?: string;
}

/** Row for the CSV export report */
export interface ReportRow {
  filename: string;
  source: FileSource;
  sourcePath: string;
  fileSizeBytes: number;
  status: "success" | "failed";
  assetId: string;
  errorMessage: string;
  completedAt: string; // ISO 8601
}

/** Scanned file from a directory */
export interface ScannedFile {
  name: string;
  path: string;
  size: number;
}
