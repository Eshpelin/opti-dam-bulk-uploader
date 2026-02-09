"use client";

import { useCallback, useRef, useState } from "react";
import { useUploadStore } from "@/stores/upload-store";
import { Upload, FolderOpen } from "lucide-react";
import { Button } from "@/components/ui/button";

// FileSystem Access API type declarations (not included in TypeScript's lib)
interface FileSystemEntry {
  isFile: boolean;
  isDirectory: boolean;
  name: string;
}

interface FileSystemFileEntry extends FileSystemEntry {
  file(successCb: (file: File) => void, errorCb?: (err: Error) => void): void;
}

interface FileSystemDirectoryEntry extends FileSystemEntry {
  createReader(): FileSystemDirectoryReader;
}

interface FileSystemDirectoryReader {
  readEntries(
    successCb: (entries: FileSystemEntry[]) => void,
    errorCb?: (err: Error) => void
  ): void;
}

/**
 * Recursively read a FileSystemEntry (file or directory) and return
 * all files with their relative directory paths.
 */
async function readEntryRecursively(
  entry: FileSystemEntry,
  basePath: string
): Promise<Array<{ file: File; relativePath: string | null }>> {
  if (entry.isFile) {
    const fileEntry = entry as FileSystemFileEntry;
    const file = await new Promise<File>((resolve, reject) => {
      fileEntry.file(resolve, reject);
    });
    return [{ file, relativePath: basePath || null }];
  }

  if (entry.isDirectory) {
    const dirEntry = entry as FileSystemDirectoryEntry;
    const childPath = basePath ? `${basePath}/${entry.name}` : entry.name;

    const entries = await new Promise<FileSystemEntry[]>((resolve, reject) => {
      const reader = dirEntry.createReader();
      const allEntries: FileSystemEntry[] = [];

      // readEntries may return results in batches, so read until empty
      const readBatch = () => {
        reader.readEntries((batch) => {
          if (batch.length === 0) {
            resolve(allEntries);
          } else {
            allEntries.push(...batch);
            readBatch();
          }
        }, reject);
      };
      readBatch();
    });

    const results: Array<{ file: File; relativePath: string | null }> = [];
    for (const child of entries) {
      const childResults = await readEntryRecursively(child, childPath);
      results.push(...childResults);
    }
    return results;
  }

  return [];
}

export function DropZone() {
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const addFiles = useUploadStore((s) => s.addFiles);

  const handleFiles = useCallback(
    (fileList: FileList) => {
      const items = Array.from(fileList).map((file) => ({
        name: file.name,
        size: file.size,
        source: "local" as const,
        sourcePath: "browser-drop",
        browserFile: file,
      }));
      addFiles(items);
    },
    [addFiles]
  );

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);

      // Try the FileSystem Entry API for folder support
      const items = e.dataTransfer.items;
      if (items && items.length > 0) {
        const entries: FileSystemEntry[] = [];
        for (let i = 0; i < items.length; i++) {
          const entry = (items[i] as DataTransferItem & {
            webkitGetAsEntry?: () => FileSystemEntry | null;
          }).webkitGetAsEntry?.();
          if (entry) entries.push(entry);
        }

        if (entries.length > 0) {
          const allResults: Array<{ file: File; relativePath: string | null }> = [];
          for (const entry of entries) {
            const results = await readEntryRecursively(entry, "");
            allResults.push(...results);
          }

          if (allResults.length > 0) {
            const fileItems = allResults.map(({ file, relativePath }) => ({
              name: file.name,
              size: file.size,
              source: "local" as const,
              sourcePath: "browser-drop",
              browserFile: file,
              relativePath: relativePath ?? undefined,
            }));
            addFiles(fileItems);
            return;
          }
        }
      }

      // Fallback for browsers without entry API
      if (e.dataTransfer.files.length > 0) {
        handleFiles(e.dataTransfer.files);
      }
    },
    [addFiles, handleFiles]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleFolderSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const fileList = e.target.files;
      if (!fileList || fileList.length === 0) return;

      const items = Array.from(fileList).map((file) => {
        // webkitRelativePath is e.g. "MyFolder/sub/file.txt"
        const relPath = (file as File & { webkitRelativePath?: string }).webkitRelativePath || "";
        const lastSlash = relPath.lastIndexOf("/");
        const relativePath = lastSlash > 0 ? relPath.substring(0, lastSlash) : undefined;

        return {
          name: file.name,
          size: file.size,
          source: "local" as const,
          sourcePath: "browser-drop",
          browserFile: file,
          relativePath,
        };
      });

      addFiles(items);
      e.target.value = "";
    },
    [addFiles]
  );

  return (
    <div className="space-y-2">
      {/* Hidden inputs live outside the drop zone so .click() does not bubble into it */}
      <input
        ref={inputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => {
          if (e.target.files) handleFiles(e.target.files);
          e.target.value = "";
        }}
      />
      <input
        ref={folderInputRef}
        type="file"
        className="hidden"
        {...({ webkitdirectory: "", directory: "" } as React.InputHTMLAttributes<HTMLInputElement>)}
        onChange={handleFolderSelect}
      />
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => inputRef.current?.click()}
        className={`
          border-2 border-dashed rounded-lg p-8 text-center cursor-pointer
          transition-colors duration-200
          ${
            isDragging
              ? "border-primary bg-primary/5"
              : "border-muted-foreground/25 hover:border-muted-foreground/50"
          }
        `}
      >
        <Upload className="h-8 w-8 mx-auto mb-3 text-muted-foreground" />
        <p className="text-sm font-medium">
          Drag and drop files or folders here, or click to browse files
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          Supports any file type, up to 5 TB per file
        </p>
      </div>
      <Button
        variant="outline"
        size="sm"
        className="w-full"
        onClick={() => folderInputRef.current?.click()}
      >
        <FolderOpen className="h-4 w-4 mr-2" />
        Or choose a folder
      </Button>
    </div>
  );
}
