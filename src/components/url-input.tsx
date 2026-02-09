"use client";

import { useState } from "react";
import { useUploadStore } from "@/stores/upload-store";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Link } from "lucide-react";

export function UrlInput() {
  const [text, setText] = useState("");
  const addFiles = useUploadStore((s) => s.addFiles);
  const addLog = useUploadStore((s) => s.addLog);

  const handleAdd = () => {
    const lines = text
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    const validUrls: string[] = [];
    const invalidLines: string[] = [];

    for (const line of lines) {
      if (line.startsWith("http://") || line.startsWith("https://")) {
        validUrls.push(line);
      } else {
        invalidLines.push(line);
      }
    }

    if (invalidLines.length > 0) {
      addLog(
        "warn",
        `Skipped ${invalidLines.length} invalid URL(s). URLs must start with http:// or https://`
      );
    }

    if (validUrls.length > 0) {
      const items = validUrls.map((url) => {
        // Extract filename from URL
        const urlObj = new URL(url);
        const pathParts = urlObj.pathname.split("/").filter(Boolean);
        const name =
          pathParts.length > 0
            ? decodeURIComponent(pathParts[pathParts.length - 1])
            : `upload-${Date.now()}`;

        return {
          name,
          size: 0, // unknown until HEAD request
          source: "url" as const,
          sourcePath: url,
        };
      });

      addFiles(items);
      setText("");
      addLog("info", `Added ${validUrls.length} URL(s) to queue`);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-sm font-medium">
        <Link className="h-4 w-4" />
        Upload from URLs
      </div>
      <Textarea
        placeholder="Paste URLs here, one per line&#10;https://example.com/video.mp4&#10;https://example.com/image.png"
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={3}
        className="font-mono text-xs"
      />
      <Button
        onClick={handleAdd}
        variant="outline"
        size="sm"
        disabled={text.trim().length === 0}
      >
        Add URLs
      </Button>
    </div>
  );
}
