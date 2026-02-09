"use client";

import { useState, useMemo } from "react";
import { useUploadStore } from "@/stores/upload-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FolderOpen, Loader2, X } from "lucide-react";

export function FolderSelector() {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const folders = useUploadStore((s) => s.folders);
  const foldersLoading = useUploadStore((s) => s.foldersLoading);
  const selectedFolderId = useUploadStore((s) => s.selectedFolderId);
  const setSelectedFolderId = useUploadStore((s) => s.setSelectedFolderId);

  const selectedFolder = useMemo(
    () => folders.find((f) => f.id === selectedFolderId),
    [folders, selectedFolderId]
  );

  const filtered = useMemo(() => {
    if (!search.trim()) return folders.slice(0, 50);
    const term = search.toLowerCase();
    return folders
      .filter(
        (f) =>
          f.name.toLowerCase().includes(term) ||
          f.breadcrumb.toLowerCase().includes(term)
      )
      .slice(0, 50);
  }, [folders, search]);

  if (foldersLoading) {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Loader2 className="h-3 w-3 animate-spin" />
        Loading folders...
      </div>
    );
  }

  return (
    <div className="relative">
      <div className="flex items-center gap-2">
        <FolderOpen className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm text-muted-foreground">Target folder:</span>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setIsOpen(!isOpen)}
          className="h-7 text-xs"
        >
          {selectedFolder ? selectedFolder.breadcrumb : "Root (default)"}
        </Button>
        {selectedFolderId && (
          <button
            onClick={() => setSelectedFolderId(null)}
            className="text-muted-foreground hover:text-foreground"
          >
            <X className="h-3 w-3" />
          </button>
        )}
      </div>

      {isOpen && (
        <div className="absolute top-full left-0 mt-1 w-96 bg-popover border rounded-md shadow-lg z-50 p-2">
          <Input
            placeholder="Search folders..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="mb-2 h-8 text-xs"
            autoFocus
          />
          <div className="max-h-48 overflow-y-auto">
            <button
              onClick={() => {
                setSelectedFolderId(null);
                setIsOpen(false);
              }}
              className={`w-full text-left px-2 py-1.5 text-xs rounded hover:bg-accent ${
                !selectedFolderId ? "bg-accent" : ""
              }`}
            >
              Root (default)
            </button>
            {filtered.map((folder) => (
              <button
                key={folder.id}
                onClick={() => {
                  setSelectedFolderId(folder.id);
                  setIsOpen(false);
                }}
                className={`w-full text-left px-2 py-1.5 text-xs rounded hover:bg-accent truncate ${
                  selectedFolderId === folder.id ? "bg-accent" : ""
                }`}
                title={folder.breadcrumb}
              >
                {folder.breadcrumb}
              </button>
            ))}
            {filtered.length === 0 && (
              <div className="text-xs text-muted-foreground p-2">
                No folders found
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
