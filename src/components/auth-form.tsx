"use client";

import { useState } from "react";
import { useUploadStore } from "@/stores/upload-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { fetchAndStoreFolders } from "@/lib/fetch-folders";
import { fetchAndStoreUsers } from "@/lib/fetch-users";

export function AuthForm() {
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [showSecret, setShowSecret] = useState(false);
  const { isAuthenticating, authError, setAuthenticating, setAuthenticated, setAuthError, addLog } =
    useUploadStore();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!clientId.trim() || !clientSecret.trim()) {
      setAuthError("Both Client ID and Client Secret are required");
      return;
    }

    setAuthenticating(true);
    setAuthError(null);

    try {
      const response = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId: clientId.trim(), clientSecret: clientSecret.trim() }),
      });

      const data = await response.json();

      if (!response.ok) {
        setAuthError(data.error || "Authentication failed");
        setAuthenticating(false);
        return;
      }

      setAuthenticated(true);
      setAuthenticating(false);
      addLog("success", "Successfully connected to Optimizely CMP");

      // Fetch folders and users/teams in background
      fetchAndStoreFolders();
      fetchAndStoreUsers();
    } catch (err) {
      setAuthError(
        err instanceof Error ? err.message : "Connection failed"
      );
      setAuthenticating(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">CMP DAM Bulk Uploader</CardTitle>
          <CardDescription>
            Upload files in bulk to Optimizely CMP
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="clientId">Client ID</Label>
              <Input
                id="clientId"
                type="text"
                placeholder="Enter your Client ID"
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                disabled={isAuthenticating}
                autoComplete="off"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="clientSecret">Client Secret</Label>
              <div className="relative">
                <Input
                  id="clientSecret"
                  type={showSecret ? "text" : "password"}
                  placeholder="Enter your Client Secret"
                  value={clientSecret}
                  onChange={(e) => setClientSecret(e.target.value)}
                  disabled={isAuthenticating}
                  autoComplete="off"
                />
                <button
                  type="button"
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  onClick={() => setShowSecret(!showSecret)}
                  tabIndex={-1}
                >
                  {showSecret ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            {authError && (
              <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-md">
                {authError}
              </div>
            )}

            <Button
              type="submit"
              className="w-full"
              disabled={isAuthenticating}
            >
              {isAuthenticating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Connecting...
                </>
              ) : (
                "Connect"
              )}
            </Button>

            <div className="text-xs text-muted-foreground text-center space-y-1.5">
              <p>
                Credentials are stored in memory only and never saved to disk.
              </p>
              <p>
                You can create app credentials in{" "}
                <a
                  href="https://cmp.optimizely.com/cloud/settings/apps-and-webhooks/apps/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline hover:text-foreground"
                >
                  CMP Settings &gt; Apps &amp; Webhooks
                </a>.
              </p>
              <p className="text-amber-500">
                Use a dedicated burner app credential and rotate the secret
                immediately after you finish.
              </p>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
