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
import { X, RotateCcw, AlertTriangle, File, Link, FolderOpen } from "lucide-react";
import type { UploadFile } from "@/types";
import { formatBytes } from "@/lib/part-size-calculator";

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

  const config = statusConfig[file.status];
  const canRemove = file.status === "queued" || file.status === "failed" || file.status === "completed";
  const canRetry = file.status === "failed";

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
