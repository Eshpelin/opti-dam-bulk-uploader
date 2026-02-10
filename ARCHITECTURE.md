# Optimizely CMP DAM Bulk Uploader - Architecture Decisions

## Firm Decisions (All 20 review items resolved)

### Decision 1: Upload routing - Backend handles all API communication
All uploads route through the Next.js backend. The backend handles all CMP API
calls AND S3 presigned URL uploads. The browser is purely a UI/control panel.

### Decision 2: Dual input modes
- **Drag-and-drop / file picker**: Browser reads files via File.slice(), streams
  chunks to the backend via localhost POST. Backend forwards to S3.
  Localhost transfer is memory-copy speed, negligible overhead.
- **Path input**: User types or pastes a file path or directory path. Backend reads
  directly from the filesystem using Node.js streams. Zero browser memory usage.
  Best for 100GB+ files and batch directories.

### Decision 3: Upload strategy threshold - 5 MB
- Files under 5 MB: Standard upload (GET /v3/upload-url, POST to presigned URL)
- Files 5 MB and above: Multipart upload (POST /v3/multipart-uploads)
This gives retry-per-chunk capability to nearly all uploads.

### Decision 4: State management - Zustand
Zustand with selectors. React Context would cause catastrophic re-renders
with frequent progress updates from concurrent uploads.

### Decision 5: Content-Type on S3 PUT
Backend must omit Content-Type header when PUTting chunks to S3 presigned URLs.
The CMP docs explicitly forbid it. When receiving chunks from the browser,
strip any content type before forwarding.

### Decision 6: Key origin mapping
- Standard upload: key comes from GET /v3/upload-url response (BEFORE upload)
- Multipart upload: key comes from POST /v3/multipart-uploads/{id}/complete
  response or GET /v3/multipart-uploads/{id}/status when UPLOAD_COMPLETION_SUCCEEDED
- Both keys are then used in POST /v3/assets to register the asset.

### Decision 7: upload_meta_fields handling
GET /v3/upload-url response includes upload_meta_fields as an ordered array.
Each entry has name and value. When building the FormData for standard upload:
append each field in order, then append file field last.

### Decision 8: URL uploads when Content-Length is unknown
1. Send HEAD request to get Content-Length.
2. If HEAD fails, send GET with Range: bytes=0-0 to check range support.
3. If size unknown: download to temp file, measure size, then upload. Clean up after.
4. If temp download would exceed 10 GB, abort with message to download locally first.

### Decision 9: Status polling timeout
Max polling duration: 30 minutes. Poll interval: 2 seconds.
After 30 minutes of UPLOAD_COMPLETION_IN_PROGRESS, mark as failed.

### Decision 10: Retry strategy - chunk vs file level
- Chunk retry: 3 attempts with exponential backoff (1s, 2s, 4s). Automatic.
- File retry for files over 100 MB: NOT automatic. Mark failed. User re-queues manually.
- File retry for files under 100 MB: automatic once.

### Decision 11: Concurrency - adaptive
Base: 6 concurrent upload connections to S3.
- 1 file: 1 file, 6 parallel chunks
- 2-3 files: distribute 6 slots evenly
- 4+ files: 6 files, 1 chunk each
User can adjust with slider (1-12).
CMP API calls: max 6/second (below 8/s documented limit).

### Decision 12: Presigned URL expiry - honest handling
Before starting multipart upload, estimate duration.
If > 55 minutes: show warning that URLs may expire.
Maximize part_size to reduce overhead.
Do NOT promise resume capability that does not exist.

### Decision 13: Console log - virtualized with limits
@tanstack/react-virtual for rendering.
Max 50,000 entries, oldest evicted first.
Filter buttons: All / Errors / Warnings / Info.
Auto-scroll toggleable.

### Decision 14: Distribution - npm global install
Primary: npm install -g, creates CLI command that runs next start.
Secondary: Docker image. Future: standalone binary.

### Decision 15: Token manager - local-only singleton
Module-level singleton in Next.js process. Works with next start.
Token refresh: 5 minutes before expiry, or immediately on 401.

### Decision 16: Folder selection - searchable dropdown
Fetch all folders on auth (paginated GET /v3/folders).
Display as searchable dropdown with breadcrumb paths.
Default to root.

### Decision 17: Asset title derivation
- Local files: original filename with extension
- URLs: extract from URL path, fallback to "upload-{timestamp}"

### Decision 18: beforeunload guard
Active only when uploads are in progress. Removed when all done.

### Decision 19: URL download backpressure
Download one part_size chunk at a time. Upload it. Then download next.
Max memory per URL download: 1 x part_size.

### Decision 20: Testing strategy
Mock CMP API with msw for tests.
Manual test matrix in ARCHITECTURE.md covers all scenarios.
