"use client";

import { useEffect, useState } from "react";
import { useUploadStore } from "@/stores/upload-store";
import { AuthForm } from "@/components/auth-form";
import { UploadDashboard } from "@/components/upload-dashboard";
import { fetchAndStoreFolders } from "@/lib/fetch-folders";
import { fetchAndStoreUsers } from "@/lib/fetch-users";
import { Loader2 } from "lucide-react";

export default function Home() {
  const isAuthenticated = useUploadStore((s) => s.isAuthenticated);
  const setAuthenticated = useUploadStore((s) => s.setAuthenticated);
  const addLog = useUploadStore((s) => s.addLog);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function checkSession() {
      try {
        const res = await fetch("/api/auth");
        const data = await res.json();

        if (cancelled) return;

        if (data.authenticated) {
          setAuthenticated(true);
          addLog("info", "Session restored from server");
          fetchAndStoreFolders();
          fetchAndStoreUsers();
        }
      } catch {
        // Backend unreachable, stay on login screen
      } finally {
        if (!cancelled) {
          setChecking(false);
        }
      }
    }

    checkSession();
    return () => {
      cancelled = true;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span className="text-sm">Checking session...</span>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <AuthForm />;
  }

  return <UploadDashboard />;
}
