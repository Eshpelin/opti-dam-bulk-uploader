"use client";

import { useUploadStore } from "@/stores/upload-store";
import { DropZone } from "./drop-zone";
import { UrlInput } from "./url-input";
import { PathInput } from "./path-input";
import { FolderSelector } from "./folder-selector";
import { UploadQueue } from "./upload-queue";
import { ConsoleLog } from "./console-log";
import { ResultsTable } from "./results-table";
import { useBeforeUnload } from "@/hooks/use-beforeunload";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LogOut } from "lucide-react";

export function UploadDashboard() {
  const reset = useUploadStore((s) => s.reset);

  useBeforeUnload();

  const handleDisconnect = async () => {
    try {
      await fetch("/api/auth", { method: "DELETE" });
    } catch {
      // Ignore errors on disconnect
    }
    reset();
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Top bar */}
      <div className="border-b px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-sm font-semibold">Optimizely CMP DAM Bulk Uploader</h1>
          <Badge variant="outline" className="text-xs text-green-600 border-green-600">
            Connected
          </Badge>
        </div>
        <div className="flex items-center gap-3">
          <FolderSelector />
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDisconnect}
            className="h-7 text-xs"
          >
            <LogOut className="h-3 w-3 mr-1" />
            Disconnect
          </Button>
        </div>
      </div>

      {/* Main content */}
      <div className="max-w-5xl mx-auto p-4 space-y-4">
        {/* Input section */}
        <Tabs defaultValue="files" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="files">Drop Files</TabsTrigger>
            <TabsTrigger value="urls">From URLs</TabsTrigger>
            <TabsTrigger value="path">From Path</TabsTrigger>
          </TabsList>
          <TabsContent value="files" className="mt-3">
            <DropZone />
          </TabsContent>
          <TabsContent value="urls" className="mt-3">
            <UrlInput />
          </TabsContent>
          <TabsContent value="path" className="mt-3">
            <PathInput />
          </TabsContent>
        </Tabs>

        <Separator />

        {/* Upload queue */}
        <UploadQueue />

        <Separator />

        {/* Console log */}
        <ConsoleLog />

        {/* Results table */}
        <ResultsTable />
      </div>
    </div>
  );
}
