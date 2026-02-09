"use client";

import { useUploadStore } from "@/stores/upload-store";
import type { UploadFile, ReportRow } from "@/types";

function datestamp(): string {
  return new Date().toISOString().split("T")[0];
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function csvEscape(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/**
 * Build the results CSV string from current store state.
 * Shared between the manual "Download CSV" button and auto-export.
 */
export function buildResultsCsv(): string {
  const store = useUploadStore.getState();
  const { fileOrder, files, folders, users, teams } = store;

  const results: UploadFile[] = [];
  for (const id of fileOrder) {
    const file = files.get(id);
    if (file && (file.status === "completed" || file.status === "failed")) {
      results.push(file);
    }
  }

  if (results.length === 0) return "";

  const getFolderLabel = (folderId: string | null) => {
    if (!folderId) return "Root";
    return folders.find((f) => f.id === folderId)?.breadcrumb ?? "Unknown";
  };

  const getAccessorLabel = (file: UploadFile) => {
    if (!file.accessorId) return "";
    if (file.accessorType === "team") {
      return teams.find((t) => t.id === file.accessorId)?.name ?? "Unknown";
    }
    return users.find((u) => u.id === file.accessorId)?.fullName ?? "Unknown";
  };

  const rows: ReportRow[] = results.map((f) => ({
    filename: f.name,
    source: f.source,
    sourcePath: f.sourcePath,
    fileSizeBytes: f.size,
    status: f.status === "completed" ? "success" : "failed",
    assetId: f.assetId || "",
    folder: getFolderLabel(f.folderId),
    accessor: getAccessorLabel(f),
    accessType: f.accessorId ? f.accessType : "",
    errorMessage: f.error || "",
    completedAt: f.completedAt
      ? new Date(f.completedAt).toISOString()
      : "",
  }));

  const header =
    "filename,source,source_path,file_size_bytes,status,asset_id,folder,accessor,access_type,error_message,completed_at";
  const csvRows = rows.map((r) =>
    [
      csvEscape(r.filename),
      r.source,
      csvEscape(r.sourcePath),
      r.fileSizeBytes,
      r.status,
      r.assetId,
      csvEscape(r.folder),
      csvEscape(r.accessor),
      r.accessType,
      csvEscape(r.errorMessage),
      r.completedAt,
    ].join(",")
  );

  return [header, ...csvRows].join("\n");
}

/**
 * Build the logs text from current store state.
 */
function buildLogsTxt(): string {
  const store = useUploadStore.getState();
  const lines = store.logs.map((log) => {
    const ts = new Date(log.timestamp).toISOString();
    const prefix = log.fileName ? `[${log.fileName}] ` : "";
    return `${ts} [${log.severity.toUpperCase()}] ${prefix}${log.message}`;
  });
  return lines.join("\n");
}

/**
 * Download the results CSV file.
 */
export function downloadResultsCsv() {
  const csv = buildResultsCsv();
  if (!csv) return;
  triggerDownload(
    new Blob([csv], { type: "text/csv" }),
    `cmp-upload-report-${datestamp()}.csv`
  );
}

/**
 * Download the console logs as a text file.
 */
export function downloadLogsTxt() {
  const txt = buildLogsTxt();
  if (!txt) return;
  triggerDownload(
    new Blob([txt], { type: "text/plain" }),
    `cmp-upload-logs-${datestamp()}.txt`
  );
}

/**
 * Auto-export both logs and results. Called when uploads finish.
 */
export function autoExportAll() {
  downloadResultsCsv();
  downloadLogsTxt();
}
