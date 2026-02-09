/**
 * Token Manager - Singleton for CMP OAuth token lifecycle.
 *
 * State is stored on globalThis so it survives Turbopack HMR in development.
 * In production (next start), globalThis persists for the process lifetime anyway.
 *
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

interface TokenState {
  credentials: StoredCredentials | null;
  tokenData: TokenData | null;
  refreshTimer: ReturnType<typeof setTimeout> | null;
}

// Anchor state to globalThis so Turbopack HMR module re-evaluation
// does not wipe the token between route handler invocations.
const g = globalThis as typeof globalThis & { __cmpTokenState?: TokenState };
if (!g.__cmpTokenState) {
  g.__cmpTokenState = { credentials: null, tokenData: null, refreshTimer: null };
}
const state = g.__cmpTokenState;

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
  if (state.refreshTimer) {
    clearTimeout(state.refreshTimer);
    state.refreshTimer = null;
  }

  if (!state.tokenData || !state.credentials) return;

  const msUntilExpiry = state.tokenData.expiresAt - Date.now();
  const refreshIn = Math.max(msUntilExpiry - REFRESH_BUFFER_MS, 0);

  state.refreshTimer = setTimeout(async () => {
    try {
      await refresh();
    } catch {
      // Refresh failed. The next getToken() call will try again.
    }
  }, refreshIn);
}

async function refresh(): Promise<void> {
  if (!state.credentials) {
    throw new Error("No credentials stored. Call authenticate() first.");
  }

  const result = await fetchToken(
    state.credentials.clientId,
    state.credentials.clientSecret
  );

  state.tokenData = {
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

  state.credentials = { clientId, clientSecret };
  state.tokenData = {
    accessToken: result.access_token,
    expiresAt: Date.now() + result.expires_in * 1000,
  };

  scheduleRefresh();
}

export async function getToken(): Promise<string> {
  if (!state.credentials) {
    throw new Error("Not authenticated. Call authenticate() first.");
  }

  if (!state.tokenData || Date.now() >= state.tokenData.expiresAt - REFRESH_BUFFER_MS) {
    await refresh();
  }

  return state.tokenData!.accessToken;
}

export function isAuthenticated(): boolean {
  return state.credentials !== null && state.tokenData !== null;
}

export function getExpiresIn(): number | null {
  if (!state.tokenData) return null;
  return Math.max(0, Math.floor((state.tokenData.expiresAt - Date.now()) / 1000));
}

export function disconnect(): void {
  state.credentials = null;
  state.tokenData = null;
  if (state.refreshTimer) {
    clearTimeout(state.refreshTimer);
    state.refreshTimer = null;
  }
}
