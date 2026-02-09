"use client";

import { useUploadStore } from "@/stores/upload-store";
import { AuthForm } from "@/components/auth-form";
import { UploadDashboard } from "@/components/upload-dashboard";

export default function Home() {
  const isAuthenticated = useUploadStore((s) => s.isAuthenticated);

  if (!isAuthenticated) {
    return <AuthForm />;
  }

  return <UploadDashboard />;
}
