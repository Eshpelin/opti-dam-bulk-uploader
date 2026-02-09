"use client";

import { useState, useMemo } from "react";
import { useUploadStore } from "@/stores/upload-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
import { FolderOpen, Loader2, X } from "lucide-react";

interface FolderSelectorProps {
  /** Override the selected value (for per-file usage). When omitted, uses global selectedFolderId. */
  value?: string | null;
  /** Called when the user picks a folder. When omitted, updates global selectedFolderId. */
  onChange?: (folderId: string | null) => void;
  /** Compact mode for inline use in upload items */
  compact?: boolean;
}

export function FolderSelector({ value, onChange, compact }: FolderSelectorProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const folders = useUploadStore((s) => s.folders);
  const foldersLoading = useUploadStore((s) => s.foldersLoading);
  const globalFolderId = useUploadStore((s) => s.selectedFolderId);
  const setGlobalFolderId = useUploadStore((s) => s.setSelectedFolderId);

  const selectedFolderId = value !== undefined ? value : globalFolderId;
  const setSelectedFolderId = onChange ?? setGlobalFolderId;

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

  if (foldersLoading && !compact) {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Loader2 className="h-3 w-3 animate-spin" />
        Loading folders...
      </div>
    );
  }

  const label = selectedFolder ? selectedFolder.breadcrumb : "Root";

  const dropdownContent = (
    <>
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
            setOpen(false);
            setSearch("");
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
              setOpen(false);
              setSearch("");
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
    </>
  );

  return (
    <div className="flex items-center gap-1.5">
      {!compact && <FolderOpen className="h-4 w-4 text-muted-foreground" />}
      {!compact && <span className="text-sm text-muted-foreground">Default folder:</span>}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className={compact ? "h-5 text-[10px] px-1.5 font-normal" : "h-7 text-xs"}
          >
            {compact ? (
              <span className="flex items-center gap-1">
                <FolderOpen className="h-2.5 w-2.5" />
                <span className="max-w-[100px] truncate">{label}</span>
              </span>
            ) : (
              label === "Root" ? "Root (default)" : label
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent
          align={compact ? "end" : "start"}
          className={compact ? "w-72" : "w-96"}
        >
          {dropdownContent}
        </PopoverContent>
      </Popover>
      {selectedFolderId && !compact && (
        <button
          onClick={() => setSelectedFolderId(null)}
          className="text-muted-foreground hover:text-foreground"
        >
          <X className="h-3 w-3" />
        </button>
      )}
    </div>
  );
}
