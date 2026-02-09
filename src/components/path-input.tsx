"use client";

import { useState } from "react";
import { useUploadStore } from "@/stores/upload-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FolderOpen, Loader2 } from "lucide-react";
import type { ScannedFile } from "@/types";

export function PathInput() {
  const [path, setPath] = useState("");
  const [scanning, setScanning] = useState(false);
  const [scannedFiles, setScannedFiles] = useState<ScannedFile[] | null>(null);
  const addFiles = useUploadStore((s) => s.addFiles);
  const addLog = useUploadStore((s) => s.addLog);

  const handleScan = async () => {
    if (!path.trim()) return;

    setScanning(true);
    setScannedFiles(null);

    try {
      const response = await fetch("/api/scan-directory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ directoryPath: path.trim() }),
      });

      const data = await response.json();

      if (!response.ok) {
        addLog("error", data.error || "Failed to scan path");
        return;
      }

      setScannedFiles(data.files);
      addLog("info", `Found ${data.files.length} file(s) at ${path.trim()}`);
    } catch (err) {
      addLog(
        "error",
        `Scan failed: ${err instanceof Error ? err.message : "Unknown error"}`
      );
    } finally {
      setScanning(false);
    }
  };

  const handleAddAll = () => {
    if (!scannedFiles || scannedFiles.length === 0) return;

    const items = scannedFiles.map((f) => ({
      name: f.name,
      size: f.size,
      source: "path" as const,
      sourcePath: f.path,
    }));

    addFiles(items);
    setScannedFiles(null);
    setPath("");
    addLog("info", `Added ${items.length} file(s) from path to queue`);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-sm font-medium">
        <FolderOpen className="h-4 w-4" />
        Upload from local path
      </div>
      <div className="flex gap-2">
        <Input
          placeholder="/path/to/files or /path/to/file.mp4"
          value={path}
          onChange={(e) => {
            setPath(e.target.value);
            setScannedFiles(null);
          }}
          className="font-mono text-xs"
          onKeyDown={(e) => {
            if (e.key === "Enter") handleScan();
          }}
        />
        <Button
          onClick={handleScan}
          variant="outline"
          size="sm"
          disabled={scanning || path.trim().length === 0}
        >
          {scanning ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            "Scan"
          )}
        </Button>
      </div>

      {scannedFiles && scannedFiles.length > 0 && (
        <div className="border rounded-md p-3 space-y-2 bg-muted/30">
          <div className="text-xs text-muted-foreground">
            Found {scannedFiles.length} file(s). Total size:{" "}
            {formatSize(scannedFiles.reduce((a, f) => a + f.size, 0))}
          </div>
          <div className="max-h-32 overflow-y-auto space-y-1">
            {scannedFiles.slice(0, 50).map((f) => (
              <div
                key={f.path}
                className="text-xs font-mono flex justify-between"
              >
                <span className="truncate mr-2">{f.name}</span>
                <span className="text-muted-foreground shrink-0">
                  {formatSize(f.size)}
                </span>
              </div>
            ))}
            {scannedFiles.length > 50 && (
              <div className="text-xs text-muted-foreground">
                ...and {scannedFiles.length - 50} more
              </div>
            )}
          </div>
          <Button onClick={handleAddAll} size="sm" className="w-full">
            Add all {scannedFiles.length} file(s) to queue
          </Button>
        </div>
      )}

      {scannedFiles && scannedFiles.length === 0 && (
        <div className="text-xs text-muted-foreground">
          No files found at this path.
        </div>
      )}
    </div>
  );
}

function formatSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}
