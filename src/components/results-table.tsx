"use client";

import { useMemo } from "react";
import { useUploadStore } from "@/stores/upload-store";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Download, Copy, Check } from "lucide-react";
import { formatBytes } from "@/lib/part-size-calculator";
import type { UploadFile, ReportRow } from "@/types";
import { useState } from "react";

export function ResultsTable() {
  const fileOrder = useUploadStore((s) => s.fileOrder);
  const files = useUploadStore((s) => s.files);
  const folders = useUploadStore((s) => s.folders);
  const users = useUploadStore((s) => s.users);
  const teams = useUploadStore((s) => s.teams);

  const results = useMemo(() => {
    const items: UploadFile[] = [];
    for (const id of fileOrder) {
      const file = files.get(id);
      if (file && (file.status === "completed" || file.status === "failed")) {
        items.push(file);
      }
    }
    return items;
  }, [fileOrder, files]);

  const stats = useMemo(() => {
    let succeeded = 0;
    let failed = 0;
    for (const f of results) {
      if (f.status === "completed") succeeded++;
      else failed++;
    }
    return { succeeded, failed, total: results.length };
  }, [results]);

  if (results.length === 0) return null;

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

  const handleExportCsv = () => {
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

    const csv = [header, ...csvRows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `cmp-upload-report-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold">Results</h3>
          <span className="text-xs text-muted-foreground">
            {stats.succeeded} succeeded, {stats.failed} failed out of{" "}
            {stats.total} total
          </span>
        </div>
        <Button onClick={handleExportCsv} variant="outline" size="sm" className="h-7">
          <Download className="h-3 w-3 mr-1" />
          Download CSV
        </Button>
      </div>

      <div className="border rounded-md max-h-[300px] overflow-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-xs w-[200px]">File</TableHead>
              <TableHead className="text-xs w-[60px]">Source</TableHead>
              <TableHead className="text-xs w-[80px]">Size</TableHead>
              <TableHead className="text-xs w-[70px]">Status</TableHead>
              <TableHead className="text-xs w-[120px]">Folder</TableHead>
              <TableHead className="text-xs w-[120px]">Accessor</TableHead>
              <TableHead className="text-xs w-[50px]">Access</TableHead>
              <TableHead className="text-xs w-[180px]">Asset ID</TableHead>
              <TableHead className="text-xs">Error</TableHead>
              <TableHead className="text-xs w-[80px]">Time</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {results.map((file) => (
              <ResultRow
                key={file.id}
                file={file}
                folderLabel={getFolderLabel(file.folderId)}
                accessorLabel={getAccessorLabel(file)}
              />
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function ResultRow({ file, folderLabel, accessorLabel }: { file: UploadFile; folderLabel: string; accessorLabel: string }) {
  const [copied, setCopied] = useState(false);

  const copyAssetId = () => {
    if (file.assetId) {
      navigator.clipboard.writeText(file.assetId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <TableRow>
      <TableCell className="text-xs font-mono truncate max-w-[200px]">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger className="truncate block">
              {file.name}
            </TooltipTrigger>
            <TooltipContent>
              <p className="font-mono text-xs">{file.sourcePath}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </TableCell>
      <TableCell className="text-xs capitalize">{file.source}</TableCell>
      <TableCell className="text-xs">
        {file.size > 0 ? formatBytes(file.size) : "N/A"}
      </TableCell>
      <TableCell>
        <Badge
          variant={file.status === "completed" ? "default" : "destructive"}
          className="text-[10px] h-5"
        >
          {file.status === "completed" ? "Success" : "Failed"}
        </Badge>
      </TableCell>
      <TableCell className="text-xs truncate max-w-[120px]" title={folderLabel}>
        {folderLabel}
      </TableCell>
      <TableCell className="text-xs truncate max-w-[120px]" title={accessorLabel}>
        {accessorLabel || "-"}
      </TableCell>
      <TableCell className="text-xs">
        {file.accessorId ? file.accessType : "-"}
      </TableCell>
      <TableCell className="text-xs font-mono">
        {file.assetId ? (
          <div className="flex items-center gap-1">
            <span className="truncate max-w-[140px]">{file.assetId}</span>
            <button
              onClick={copyAssetId}
              className="shrink-0 text-muted-foreground hover:text-foreground"
              title="Copy Asset ID"
            >
              {copied ? (
                <Check className="h-3 w-3 text-green-500" />
              ) : (
                <Copy className="h-3 w-3" />
              )}
            </button>
          </div>
        ) : (
          <span className="text-muted-foreground">-</span>
        )}
      </TableCell>
      <TableCell className="text-xs text-destructive truncate max-w-[200px]">
        {file.error || "-"}
      </TableCell>
      <TableCell className="text-xs text-muted-foreground">
        {file.completedAt
          ? new Date(file.completedAt).toLocaleTimeString()
          : "-"}
      </TableCell>
    </TableRow>
  );
}

function csvEscape(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}
