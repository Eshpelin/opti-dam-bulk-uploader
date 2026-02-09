"use client";

import { useEffect } from "react";
import { useUploadStore } from "@/stores/upload-store";

/**
 * Warns the user before closing the tab when uploads are in progress.
 * Also updates the document title with upload progress.
 */
export function useBeforeUnload() {
  const files = useUploadStore((s) => s.files);
  const fileOrder = useUploadStore((s) => s.fileOrder);
  const isAuthenticated = useUploadStore((s) => s.isAuthenticated);

  useEffect(() => {
    let activeCount = 0;
    let completedCount = 0;
    let totalCount = fileOrder.length;

    for (const id of fileOrder) {
      const file = files.get(id);
      if (!file) continue;
      if (
        file.status === "uploading" ||
        file.status === "completing" ||
        file.status === "registering"
      ) {
        activeCount++;
      }
      if (file.status === "completed") {
        completedCount++;
      }
    }

    const hasActiveUploads = activeCount > 0;

    // Update document title
    if (hasActiveUploads) {
      document.title = `Uploading ${completedCount}/${totalCount}... | CMP Bulk Uploader`;
    } else if (totalCount > 0 && completedCount === totalCount) {
      document.title = "Complete | CMP Bulk Uploader";
    } else if (isAuthenticated) {
      document.title = "CMP DAM Bulk Uploader";
    } else {
      document.title = "CMP DAM Bulk Uploader";
    }

    // beforeunload handler
    const handler = (e: BeforeUnloadEvent) => {
      if (hasActiveUploads) {
        e.preventDefault();
        e.returnValue = "";
      }
    };

    if (hasActiveUploads) {
      window.addEventListener("beforeunload", handler);
    }

    return () => {
      window.removeEventListener("beforeunload", handler);
    };
  }, [files, fileOrder, isAuthenticated]);
}
