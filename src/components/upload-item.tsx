"use client";

import { useUploadStore } from "@/stores/upload-store";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { X, RotateCcw, AlertTriangle, File, Link, FolderOpen, Ban, User, Users } from "lucide-react";
import type { UploadFile } from "@/types";
import { formatBytes } from "@/lib/part-size-calculator";
import { cancelUpload } from "@/lib/upload-orchestrator";
import { FolderSelector } from "./folder-selector";
import { AccessorSelector } from "./accessor-selector";
import type { AccessorType } from "@/types";

const statusConfig: Record<
  UploadFile["status"],
  { label: string; variant: "default" | "secondary" | "destructive" | "outline" }
> = {
  queued: { label: "Queued", variant: "secondary" },
  uploading: { label: "Uploading", variant: "default" },
  completing: { label: "Processing", variant: "outline" },
  registering: { label: "Registering", variant: "outline" },
  completed: { label: "Done", variant: "default" },
  failed: { label: "Failed", variant: "destructive" },
};

const sourceIcons: Record<UploadFile["source"], React.ReactNode> = {
  local: <File className="h-3 w-3" />,
  url: <Link className="h-3 w-3" />,
  path: <FolderOpen className="h-3 w-3" />,
};

interface Props {
  file: UploadFile;
}

export function UploadItem({ file }: Props) {
  const removeFile = useUploadStore((s) => s.removeFile);
  const retryFile = useUploadStore((s) => s.retryFile);
  const setFileFolderId = useUploadStore((s) => s.setFileFolderId);
  const setFileAccessor = useUploadStore((s) => s.setFileAccessor);
  const setFileAccessType = useUploadStore((s) => s.setFileAccessType);
  const folders = useUploadStore((s) => s.folders);
  const users = useUploadStore((s) => s.users);
  const teams = useUploadStore((s) => s.teams);

  const config = statusConfig[file.status];
  const canRemove = file.status === "queued" || file.status === "failed" || file.status === "completed";
  const canCancel = file.status === "uploading" || file.status === "completing" || file.status === "registering";
  const canRetry = file.status === "failed";

  const accessorLabel = file.accessorId
    ? file.accessorType === "team"
      ? teams.find((t) => t.id === file.accessorId)?.name ?? "Unknown"
      : users.find((u) => u.id === file.accessorId)?.fullName ?? "Unknown"
    : null;

  return (
    <div className="flex items-center gap-3 p-2 rounded-md hover:bg-muted/50 group">
      {/* Source icon */}
      <div className="text-muted-foreground shrink-0">{sourceIcons[file.source]}</div>

      {/* File name and size */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="text-sm truncate block max-w-[200px]">
                  {file.name}
                </span>
              </TooltipTrigger>
              <TooltipContent>
                <p className="font-mono text-xs">{file.sourcePath}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <span className="text-xs text-muted-foreground shrink-0">
            {file.size > 0 ? formatBytes(file.size) : "Size unknown"}
          </span>
          {file.status === "queued" ? (
            <>
              <FolderSelector
                value={file.folderId}
                onChange={(folderId) => setFileFolderId(file.id, folderId)}
                compact
              />
              <AccessorSelector
                value={
                  file.accessorId && file.accessorType
                    ? { id: file.accessorId, type: file.accessorType }
                    : null
                }
                onChange={(accessor) => setFileAccessor(file.id, accessor)}
                accessType={file.accessType}
                onAccessTypeChange={(at) => setFileAccessType(file.id, at)}
                compact
              />
            </>
          ) : (
            <>
              <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
                <FolderOpen className="h-2.5 w-2.5" />
                <span className="max-w-[100px] truncate">
                  {file.folderId
                    ? (folders.find((f) => f.id === file.folderId)?.breadcrumb ?? "Unknown")
                    : "Root"}
                </span>
              </span>
              {accessorLabel && (
                <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
                  {file.accessorType === "team" ? (
                    <Users className="h-2.5 w-2.5" />
                  ) : (
                    <User className="h-2.5 w-2.5" />
                  )}
                  <span className="max-w-[80px] truncate">{accessorLabel}</span>
                  <span>({file.accessType})</span>
                </span>
              )}
            </>
          )}
        </div>

        {/* Progress bar (only when uploading/completing) */}
        {(file.status === "uploading" ||
          file.status === "completing" ||
          file.status === "registering") && (
          <div className="mt-1">
            <Progress value={file.progress} className="h-1.5" />
          </div>
        )}
      </div>

      {/* Status and stats */}
      <div className="flex items-center gap-2 shrink-0">
        {file.status === "uploading" && file.speed > 0 && (
          <span className="text-xs text-muted-foreground">
            {formatBytes(file.speed)}/s
          </span>
        )}

        {file.status === "uploading" && (
          <span className="text-xs text-muted-foreground">
            {file.progress}%
          </span>
        )}

        {file.status === "completed" && file.assetId && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="text-xs text-muted-foreground font-mono cursor-default">
                  {file.assetId.substring(0, 8)}...
                </span>
              </TooltipTrigger>
              <TooltipContent>
                <p className="font-mono text-xs">Asset ID: {file.assetId}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}

        {file.status === "failed" && file.error && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger>
                <AlertTriangle className="h-3.5 w-3.5 text-destructive" />
              </TooltipTrigger>
              <TooltipContent className="max-w-sm">
                <p className="text-xs">{file.error}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}

        <Badge
          variant={config.variant}
          className="text-[10px] h-5 px-1.5"
        >
          {config.label}
        </Badge>

        {/* Actions */}
        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
          {canCancel && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => cancelUpload(file.id)}
              className="h-6 w-6 p-0 text-destructive hover:text-destructive"
              title="Cancel upload"
            >
              <Ban className="h-3 w-3" />
            </Button>
          )}
          {canRetry && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => retryFile(file.id)}
              className="h-6 w-6 p-0"
              title="Retry"
            >
              <RotateCcw className="h-3 w-3" />
            </Button>
          )}
          {canRemove && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => removeFile(file.id)}
              className="h-6 w-6 p-0"
              title="Remove"
            >
              <X className="h-3 w-3" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
