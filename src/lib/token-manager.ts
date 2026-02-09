/**
 * Token Manager - Singleton for CMP OAuth token lifecycle.
 *
 * This module is designed to run in a persistent Node.js process (next start).
 * Do NOT deploy to serverless platforms where each request creates a fresh instance.
 */

const TOKEN_ENDPOINT =
  "https://accounts.cmp.optimizely.com/o/oauth2/v1/token";
const REFRESH_BUFFER_MS = 5 * 60 * 1000; // refresh 5 minutes before expiry

interface StoredCredentials {
  clientId: string;
  clientSecret: string;
}

interface TokenData {
  accessToken: string;
  expiresAt: number; // Unix ms
}

let credentials: StoredCredentials | null = null;
let tokenData: TokenData | null = null;
let refreshTimer: ReturnType<typeof setTimeout> | null = null;

async function fetchToken(
  clientId: string,
  clientSecret: string
): Promise<{ access_token: string; expires_in: number }> {
  const response = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "client_credentials",
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(
      `Authentication failed (${response.status}): ${body}`
    );
  }

  return response.json();
}

function scheduleRefresh() {
  if (refreshTimer) {
    clearTimeout(refreshTimer);
    refreshTimer = null;
  }

  if (!tokenData || !credentials) return;

  const msUntilExpiry = tokenData.expiresAt - Date.now();
  const refreshIn = Math.max(msUntilExpiry - REFRESH_BUFFER_MS, 0);

  refreshTimer = setTimeout(async () => {
    try {
      await refresh();
    } catch {
      // Refresh failed. The next getToken() call will try again.
    }
  }, refreshIn);
}

async function refresh(): Promise<void> {
  if (!credentials) {
    throw new Error("No credentials stored. Call authenticate() first.");
  }

  const result = await fetchToken(
    credentials.clientId,
    credentials.clientSecret
  );

  tokenData = {
    accessToken: result.access_token,
    expiresAt: Date.now() + result.expires_in * 1000,
  };

  scheduleRefresh();
}

export async function authenticate(
  clientId: string,
  clientSecret: string
): Promise<void> {
  const result = await fetchToken(clientId, clientSecret);

  credentials = { clientId, clientSecret };
  tokenData = {
    accessToken: result.access_token,
    expiresAt: Date.now() + result.expires_in * 1000,
  };

  scheduleRefresh();
}

export async function getToken(): Promise<string> {
  if (!credentials) {
    throw new Error("Not authenticated. Call authenticate() first.");
  }

  if (!tokenData || Date.now() >= tokenData.expiresAt - REFRESH_BUFFER_MS) {
    await refresh();
  }

  return tokenData!.accessToken;
}

export function isAuthenticated(): boolean {
  return credentials !== null && tokenData !== null;
}

export function getExpiresIn(): number | null {
  if (!tokenData) return null;
  return Math.max(0, Math.floor((tokenData.expiresAt - Date.now()) / 1000));
}

export function disconnect(): void {
  credentials = null;
  tokenData = null;
  if (refreshTimer) {
    clearTimeout(refreshTimer);
    refreshTimer = null;
  }
}
