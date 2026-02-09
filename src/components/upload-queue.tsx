"use client";

import { useMemo } from "react";
import { useUploadStore } from "@/stores/upload-store";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { UploadItem } from "./upload-item";
import {
  startOrchestrator,
  pauseOrchestrator,
} from "@/lib/upload-orchestrator";
import { Play, Pause, Trash2 } from "lucide-react";
import { formatBytes } from "@/lib/part-size-calculator";
import { AccessorSelector } from "./accessor-selector";

export function UploadQueue() {
  const fileOrder = useUploadStore((s) => s.fileOrder);
  const files = useUploadStore((s) => s.files);
  const isUploading = useUploadStore((s) => s.isUploading);
  const isPaused = useUploadStore((s) => s.isPaused);
  const maxParallelSlots = useUploadStore((s) => s.maxParallelSlots);
  const setMaxParallelSlots = useUploadStore((s) => s.setMaxParallelSlots);
  const clearCompleted = useUploadStore((s) => s.clearCompleted);
  const selectedAccessor = useUploadStore((s) => s.selectedAccessor);
  const selectedAccessType = useUploadStore((s) => s.selectedAccessType);
  const setSelectedAccessType = useUploadStore((s) => s.setSelectedAccessType);

  const stats = useMemo(() => {
    let total = 0;
    let completed = 0;
    let failed = 0;
    let uploading = 0;
    let totalBytes = 0;
    let uploadedBytes = 0;
    let totalSpeed = 0;

    for (const id of fileOrder) {
      const file = files.get(id);
      if (!file) continue;
      total++;
      if (file.status === "completed") completed++;
      if (file.status === "failed") failed++;
      if (file.status === "uploading") {
        uploading++;
        totalSpeed += file.speed;
      }
      totalBytes += file.size;
      uploadedBytes += file.bytesUploaded;
    }

    const queued = total - completed - failed - uploading;
    const eta = totalSpeed > 0 ? (totalBytes - uploadedBytes) / totalSpeed : 0;

    return { total, completed, failed, uploading, queued, totalBytes, uploadedBytes, totalSpeed, eta };
  }, [fileOrder, files]);

  if (fileOrder.length === 0) {
    return null;
  }

  const handleStart = () => {
    if (isPaused) {
      useUploadStore.getState().setIsPaused(false);
    }
    startOrchestrator();
  };

  const handlePause = () => {
    pauseOrchestrator();
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold">Upload Queue</h3>
          <Badge variant="secondary" className="text-xs">
            {stats.total} file{stats.total !== 1 ? "s" : ""}
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          {stats.completed > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearCompleted}
              className="h-7 text-xs"
            >
              <Trash2 className="h-3 w-3 mr-1" />
              Clear completed
            </Button>
          )}
          {!isUploading || isPaused ? (
            <Button
              onClick={handleStart}
              size="sm"
              className="h-7"
              disabled={stats.queued === 0}
            >
              <Play className="h-3 w-3 mr-1" />
              {isPaused ? "Resume" : "Start Upload"}
            </Button>
          ) : (
            <Button
              onClick={handlePause}
              variant="outline"
              size="sm"
              className="h-7"
            >
              <Pause className="h-3 w-3 mr-1" />
              Pause
            </Button>
          )}
        </div>
      </div>

      {/* Stats bar */}
      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        <span>
          {stats.completed}/{stats.total} complete
        </span>
        {stats.failed > 0 && (
          <span className="text-destructive">{stats.failed} failed</span>
        )}
        {stats.totalSpeed > 0 && (
          <span>Speed: {formatBytes(stats.totalSpeed)}/s</span>
        )}
        {stats.eta > 0 && stats.eta < 86400 && (
          <span>ETA: {formatEta(stats.eta)}</span>
        )}
      </div>

      {/* Parallel slots slider */}
      <div className="flex items-center gap-3 text-xs">
        <span className="text-muted-foreground whitespace-nowrap">
          Parallel uploads: {maxParallelSlots}
        </span>
        <Slider
          value={[maxParallelSlots]}
          onValueChange={([v]) => setMaxParallelSlots(v)}
          min={1}
          max={12}
          step={1}
          className="w-32"
        />
      </div>

      {/* Default accessor */}
      <div className="flex items-center gap-3">
        <AccessorSelector />
        {selectedAccessor && (
          <div className="flex items-center gap-1.5">
            <span className="text-sm text-muted-foreground">Default access:</span>
            <div className="flex items-center gap-0.5">
              <button
                onClick={() => setSelectedAccessType("view")}
                className={`text-xs px-2 py-0.5 rounded ${
                  selectedAccessType === "view"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-accent"
                }`}
              >
                View
              </button>
              <button
                onClick={() => setSelectedAccessType("edit")}
                className={`text-xs px-2 py-0.5 rounded ${
                  selectedAccessType === "edit"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-accent"
                }`}
              >
                Edit
              </button>
            </div>
          </div>
        )}
      </div>

      {/* File list */}
      <div className="space-y-1 max-h-[400px] overflow-y-auto">
        {fileOrder.map((id) => {
          const file = files.get(id);
          if (!file) return null;
          return <UploadItem key={id} file={file} />;
        })}
      </div>
    </div>
  );
}

function formatEta(seconds: number): string {
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
