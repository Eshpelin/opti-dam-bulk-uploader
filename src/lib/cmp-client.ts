/**
 * CMP API Client - wraps all Optimizely CMP API interactions.
 * Uses token-manager for auth and rate-limiter for throttling.
 */

import { getToken, authenticate as authTokens, disconnect as disconnectTokens } from "./token-manager";
import { withRateLimit } from "./rate-limiter";
import type {
  UploadUrlResponse,
  MultipartUploadResponse,
  MultipartStatusResponse,
  CreateAssetResponse,
  CompleteUploadResponse,
  AccessorType,
  AccessType,
} from "@/types";

const CMP_API_BASE = "https://api.cmp.optimizely.com";

export class CmpApiError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public responseBody?: string
  ) {
    super(message);
    this.name = "CmpApiError";
  }
}

export class AuthError extends CmpApiError {
  constructor(message: string, responseBody?: string) {
    super(message, 401, responseBody);
    this.name = "AuthError";
  }
}

/**
 * Make an authenticated, rate-limited request to the CMP API.
 * Automatically retries once on 401 (token refresh).
 */
async function cmpFetch(
  path: string,
  options: RequestInit = {}
): Promise<Response> {
  let token = await getToken();

  const doRequest = async () => {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${token}`,
      "Accept-Encoding": "gzip",
      ...(options.headers as Record<string, string> || {}),
    };

    return fetch(`${CMP_API_BASE}${path}`, {
      ...options,
      headers,
    });
  };

  // Rate-limited request with 429 handling
  let response = await withRateLimit(doRequest);

  // On 401, try refreshing the token once
  if (response.status === 401) {
    token = await getToken(); // will trigger refresh
    const retryRequest = async () => {
      const headers: Record<string, string> = {
        Authorization: `Bearer ${token}`,
        "Accept-Encoding": "gzip",
        ...(options.headers as Record<string, string> || {}),
      };

      return fetch(`${CMP_API_BASE}${path}`, {
        ...options,
        headers,
      });
    };

    response = await withRateLimit(retryRequest);
  }

  return response;
}

async function parseJsonResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const body = await response.text();
    if (response.status === 401) {
      throw new AuthError("Unauthorized. Token may have expired.", body);
    }
    // Include the response body in the message so it propagates through proxy routes
    const detail = body.length > 300 ? body.slice(0, 300) + "..." : body;
    throw new CmpApiError(
      `CMP API error (${response.status}): ${detail}`,
      response.status,
      body
    );
  }
  return response.json();
}

// ─── Public API ─────────────────────────────────────────────

export async function authenticate(
  clientId: string,
  clientSecret: string
): Promise<void> {
  await authTokens(clientId, clientSecret);
}

export function disconnect(): void {
  disconnectTokens();
}

export async function getUploadUrl(): Promise<UploadUrlResponse> {
  const response = await cmpFetch("/v3/upload-url");
  return parseJsonResponse<UploadUrlResponse>(response);
}

export async function initiateMultipartUpload(
  fileSize: number,
  partSize: number
): Promise<MultipartUploadResponse> {
  const response = await cmpFetch("/v3/multipart-uploads", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      file_size: fileSize,
      part_size: partSize,
    }),
  });
  return parseJsonResponse<MultipartUploadResponse>(response);
}

export async function completeMultipartUpload(
  uploadId: string
): Promise<CompleteUploadResponse> {
  const response = await cmpFetch(
    `/v3/multipart-uploads/${uploadId}/complete`,
    { method: "POST" }
  );
  return parseJsonResponse<CompleteUploadResponse>(response);
}

export async function getMultipartUploadStatus(
  uploadId: string
): Promise<MultipartStatusResponse> {
  const response = await cmpFetch(
    `/v3/multipart-uploads/${uploadId}/status`
  );
  return parseJsonResponse<MultipartStatusResponse>(response);
}

export async function createAsset(
  key: string,
  title: string,
  folderId?: string | null
): Promise<CreateAssetResponse> {
  const body: Record<string, string> = { key, title };
  if (folderId) {
    body.folder_id = folderId;
  }

  const response = await cmpFetch("/v3/assets", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return parseJsonResponse<CreateAssetResponse>(response);
}

interface FolderApiItem {
  id: string;
  name: string;
  parent_folder_id: string | null;
  path: string;
}

interface FolderListResponse {
  data: FolderApiItem[];
  pagination: {
    next: string | null;
    previous: string | null;
  };
}

export async function listFolders(
  offset: number = 0,
  pageSize: number = 100
): Promise<FolderListResponse> {
  const response = await cmpFetch(
    `/v3/folders?offset=${offset}&page_size=${pageSize}`
  );
  return parseJsonResponse<FolderListResponse>(response);
}

export interface FlatFolder {
  id: string;
  name: string;
  parentFolderId: string | null;
}

export async function getAllFolders(): Promise<FlatFolder[]> {
  const all: FlatFolder[] = [];
  let offset = 0;
  const pageSize = 100;

  while (true) {
    const result = await listFolders(offset, pageSize);

    for (const f of result.data) {
      all.push({
        id: f.id,
        name: f.name,
        parentFolderId: f.parent_folder_id ?? null,
      });
    }

    // If there's no next page, we're done
    if (!result.pagination.next || result.data.length < pageSize) {
      break;
    }

    offset += pageSize;
  }

  return all;
}

// ─── Users & Teams ──────────────────────────────────────────

interface UserApiItem {
  id: string;
  first_name: string;
  last_name: string;
  full_name: string;
  email: string;
  image_url: string | null;
}

interface UserListResponse {
  data: UserApiItem[];
  pagination: {
    next: string | null;
    previous: string | null;
  };
}

export async function listUsers(
  offset: number = 0,
  pageSize: number = 100
): Promise<UserListResponse> {
  const response = await cmpFetch(
    `/v3/userlist?offset=${offset}&page_size=${pageSize}`
  );
  return parseJsonResponse<UserListResponse>(response);
}

export async function getAllUsers(): Promise<Array<{ id: string; fullName: string; email: string }>> {
  const all: Array<{ id: string; fullName: string; email: string }> = [];
  let offset = 0;
  const pageSize = 100;

  while (true) {
    const result = await listUsers(offset, pageSize);

    for (const u of result.data) {
      all.push({
        id: u.id,
        fullName: u.full_name,
        email: u.email ?? "",
      });
    }

    if (!result.pagination.next || result.data.length < pageSize) {
      break;
    }

    offset += pageSize;
  }

  return all;
}

interface TeamApiItem {
  id: string;
  name: string;
}

interface TeamListResponse {
  data: TeamApiItem[];
  pagination: {
    next: string | null;
    previous: string | null;
  };
}

export async function listTeams(
  offset: number = 0,
  pageSize: number = 100
): Promise<TeamListResponse> {
  const response = await cmpFetch(
    `/v3/teams?offset=${offset}&page_size=${pageSize}`
  );
  return parseJsonResponse<TeamListResponse>(response);
}

export async function getAllTeams(): Promise<Array<{ id: string; name: string }>> {
  const all: Array<{ id: string; name: string }> = [];
  let offset = 0;
  const pageSize = 100;

  while (true) {
    const result = await listTeams(offset, pageSize);

    for (const t of result.data) {
      all.push({
        id: t.id,
        name: t.name,
      });
    }

    if (!result.pagination.next || result.data.length < pageSize) {
      break;
    }

    offset += pageSize;
  }

  return all;
}

export async function grantPermission(
  targetType: "assets" | "folders",
  targetId: string,
  accessorId: string,
  accessorType: AccessorType,
  accessType: AccessType
): Promise<void> {
  const response = await cmpFetch(`/v3/${targetType}/${targetId}/permissions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      permissions: [
        {
          type: accessorType,
          access_type: accessType,
          id: accessorId,
        },
      ],
      type: accessorType,
    }),
  });

  if (!response.ok && response.status !== 204) {
    const body = await response.text();
    throw new CmpApiError(
      `Permission grant failed (${response.status})`,
      response.status,
      body
    );
  }
}

/**
 * Upload a file to the standard (non-multipart) presigned URL.
 * Used for files under 5 MB.
 *
 * Returns the key for asset registration.
 */
export async function standardUpload(
  fileBuffer: Buffer,
  fileName: string
): Promise<string> {
  const uploadData = await getUploadUrl();

  // Build multipart/form-data with meta fields in order, file last
  const { FormData, Blob } = await import("node:buffer").then(() => ({
    FormData: globalThis.FormData,
    Blob: globalThis.Blob,
  }));

  const formData = new FormData();

  // upload_meta_fields is an object (not array). Append each key-value pair in order, file last.
  const metaFields = uploadData.upload_meta_fields;
  for (const [fieldName, fieldValue] of Object.entries(metaFields)) {
    formData.append(fieldName, fieldValue);
  }

  const arrayBuf = fileBuffer.buffer.slice(
    fileBuffer.byteOffset,
    fileBuffer.byteOffset + fileBuffer.byteLength
  ) as ArrayBuffer;
  const fileBlob = new Blob([arrayBuf]);
  formData.append("file", fileBlob, fileName);

  // POST to the presigned URL (this goes to S3, not CMP API)
  // No rate limiting needed for S3
  const uploadResponse = await fetch(uploadData.url, {
    method: "POST",
    body: formData,
  });

  if (uploadResponse.status !== 204 && !uploadResponse.ok) {
    const body = await uploadResponse.text();
    throw new CmpApiError(
      `Standard upload failed (${uploadResponse.status})`,
      uploadResponse.status,
      body
    );
  }

  // The key is inside upload_meta_fields, not a separate top-level field
  return metaFields.key;
}

/**
 * Upload a single chunk to an S3 presigned URL.
 * No Content-Type header is set (per CMP docs).
 */
export async function uploadChunkToS3(
  presignedUrl: string,
  chunkData: Buffer | Uint8Array
): Promise<void> {
  // Wrap in a Blob with no type to prevent Content-Type header
  // .slice() returns a plain ArrayBuffer, avoiding SharedArrayBuffer type incompatibility
  const arrayBuffer = chunkData.buffer.slice(
    chunkData.byteOffset,
    chunkData.byteOffset + chunkData.byteLength
  ) as ArrayBuffer;
  const blob = new Blob([arrayBuffer]);

  const response = await fetch(presignedUrl, {
    method: "PUT",
    body: blob,
  });

  if (!response.ok) {
    const body = await response.text();
    throw new CmpApiError(
      `Chunk upload failed (${response.status})`,
      response.status,
      body
    );
  }
}

/**
 * Poll multipart upload status until terminal state.
 * Throws on failure or timeout (30 minutes).
 */
export async function waitForCompletion(
  uploadId: string,
  onPoll?: (status: string) => void
): Promise<string> {
  const MAX_POLL_MS = 30 * 60 * 1000; // 30 minutes
  const POLL_INTERVAL_MS = 2000;
  const startTime = Date.now();

  while (true) {
    const status = await getMultipartUploadStatus(uploadId);
    onPoll?.(status.status);

    switch (status.status) {
      case "UPLOAD_COMPLETION_SUCCEEDED":
        if (!status.key) {
          throw new Error(
            "Upload completed but no key was returned in status response"
          );
        }
        return status.key;

      case "UPLOAD_COMPLETION_FAILED":
        throw new Error(
          `Upload completion failed: ${status.status_message ?? "Unknown error"}`
        );

      case "UPLOAD_COMPLETION_IN_PROGRESS":
        if (Date.now() - startTime > MAX_POLL_MS) {
          throw new Error(
            "Upload completion timed out after 30 minutes. " +
            "The file may still be processing on the server. Check CMP directly."
          );
        }
        await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
        break;

      case "UPLOAD_COMPLETION_NOT_STARTED":
        throw new Error(
          "Upload completion was not initiated. Call /complete first."
        );

      default:
        throw new Error(`Unexpected upload status: ${status.status}`);
    }
  }
}
