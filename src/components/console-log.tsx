"use client";

import { useEffect, useRef, useMemo, useState, useCallback } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useUploadStore } from "@/stores/upload-store";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, ChevronUp, Trash2 } from "lucide-react";
import type { LogSeverity } from "@/types";

const severityColors: Record<LogSeverity, string> = {
  info: "text-blue-400",
  warn: "text-yellow-400",
  error: "text-red-400",
  success: "text-green-400",
};

const severityLabels: Record<LogSeverity, string> = {
  info: "INFO",
  warn: "WARN",
  error: "ERR ",
  success: " OK ",
};

export function ConsoleLog() {
  const [collapsed, setCollapsed] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  const logs = useUploadStore((s) => s.logs);
  const logFilter = useUploadStore((s) => s.logFilter);
  const setLogFilter = useUploadStore((s) => s.setLogFilter);
  const clearLogs = useUploadStore((s) => s.clearLogs);

  const filteredLogs = useMemo(() => {
    if (logFilter === "all") return logs;
    if (logFilter === "error") return logs.filter((l) => l.severity === "error");
    if (logFilter === "warn")
      return logs.filter(
        (l) => l.severity === "warn" || l.severity === "error"
      );
    // "info" shows info + success
    return logs.filter(
      (l) => l.severity === "info" || l.severity === "success"
    );
  }, [logs, logFilter]);

  const virtualizer = useVirtualizer({
    count: filteredLogs.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 24,
    overscan: 20,
  });

  // Auto-scroll to bottom
  useEffect(() => {
    if (autoScroll && filteredLogs.length > 0 && scrollRef.current) {
      virtualizer.scrollToIndex(filteredLogs.length - 1, {
        align: "end",
      });
    }
  }, [filteredLogs.length, autoScroll, virtualizer]);

  // Detect manual scroll to disable auto-scroll
  const handleScroll = useCallback(() => {
    if (!scrollRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 50;
    if (!isAtBottom && autoScroll) {
      setAutoScroll(false);
    } else if (isAtBottom && !autoScroll) {
      setAutoScroll(true);
    }
  }, [autoScroll]);

  return (
    <div className="border rounded-md overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-muted/50 border-b">
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="flex items-center gap-1.5 text-sm font-semibold hover:text-foreground"
        >
          {collapsed ? (
            <ChevronDown className="h-3.5 w-3.5" />
          ) : (
            <ChevronUp className="h-3.5 w-3.5" />
          )}
          Console
          <Badge variant="secondary" className="text-[10px] h-4 px-1">
            {logs.length}
          </Badge>
        </button>

        {!collapsed && (
          <div className="flex items-center gap-1.5">
            {(["all", "error", "warn", "info"] as const).map((f) => (
              <Button
                key={f}
                variant={logFilter === f ? "default" : "ghost"}
                size="sm"
                onClick={() => setLogFilter(f)}
                className="h-5 text-[10px] px-1.5"
              >
                {f === "all"
                  ? "All"
                  : f === "error"
                    ? "Errors"
                    : f === "warn"
                      ? "Warnings"
                      : "Info"}
              </Button>
            ))}
            <Button
              variant="ghost"
              size="sm"
              onClick={clearLogs}
              className="h-5 px-1"
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        )}
      </div>

      {/* Log area */}
      {!collapsed && (
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="h-48 overflow-auto bg-background font-mono text-xs"
        >
          <div
            style={{
              height: `${virtualizer.getTotalSize()}px`,
              width: "100%",
              position: "relative",
            }}
          >
            {virtualizer.getVirtualItems().map((virtualItem) => {
              const log = filteredLogs[virtualItem.index];
              if (!log) return null;

              const time = new Date(log.timestamp);
              const timeStr = `${pad(time.getHours())}:${pad(time.getMinutes())}:${pad(time.getSeconds())}.${pad3(time.getMilliseconds())}`;

              return (
                <div
                  key={virtualItem.key}
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: "100%",
                    height: `${virtualItem.size}px`,
                    transform: `translateY(${virtualItem.start}px)`,
                  }}
                  className="flex items-center px-3 hover:bg-muted/30"
                >
                  <span className="text-muted-foreground mr-2 shrink-0">
                    {timeStr}
                  </span>
                  <span
                    className={`mr-2 shrink-0 font-bold ${severityColors[log.severity]}`}
                  >
                    [{severityLabels[log.severity]}]
                  </span>
                  {log.fileName && (
                    <span className="font-bold mr-2 shrink-0 max-w-[150px] truncate">
                      {log.fileName}
                    </span>
                  )}
                  <span className="truncate">{log.message}</span>
                </div>
              );
            })}
          </div>

          {/* Jump to bottom button */}
          {!autoScroll && filteredLogs.length > 0 && (
            <button
              onClick={() => {
                setAutoScroll(true);
                virtualizer.scrollToIndex(filteredLogs.length - 1, {
                  align: "end",
                });
              }}
              className="sticky bottom-2 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground text-[10px] px-2 py-0.5 rounded-full"
            >
              Jump to bottom
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function pad(n: number): string {
  return n.toString().padStart(2, "0");
}

function pad3(n: number): string {
  return n.toString().padStart(3, "0");
}
