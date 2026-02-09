"use client";

import { useUploadStore } from "@/stores/upload-store";

/**
 * Fetches all CMP folders, builds breadcrumb paths, and stores them.
 * Shared between auth-form (initial login) and session restore (page refresh).
 */
export async function fetchAndStoreFolders() {
  const store = useUploadStore.getState();
  store.setFoldersLoading(true);

  try {
    const response = await fetch("/api/folders");
    if (!response.ok) return;

    const data = await response.json();

    // Build breadcrumbs from parent chain
    const folderMap = new Map<
      string,
      { id: string; name: string; parentFolderId: string | null }
    >();
    for (const f of data.folders) {
      folderMap.set(f.id, f);
    }

    const foldersWithBreadcrumbs = data.folders.map(
      (f: { id: string; name: string; parentFolderId: string | null }) => {
        const parts: string[] = [];
        let current: typeof f | undefined = f;
        while (current) {
          parts.unshift(current.name);
          current = current.parentFolderId
            ? folderMap.get(current.parentFolderId)
            : undefined;
        }
        return {
          id: f.id,
          name: f.name,
          parentFolderId: f.parentFolderId,
          breadcrumb: parts.join(" > "),
        };
      }
    );

    store.setFolders(foldersWithBreadcrumbs);
    store.addLog("info", `Loaded ${foldersWithBreadcrumbs.length} folders`);
  } catch {
    store.addLog(
      "warn",
      "Could not load folders. You can still upload to root."
    );
  } finally {
    store.setFoldersLoading(false);
  }
}
