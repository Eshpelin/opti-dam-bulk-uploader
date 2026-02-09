# CMP DAM Bulk Uploader

A local web application for uploading files in bulk to Optimizely CMP (Content Marketing Platform) DAM. Supports very large files (up to 5 TB) through multipart upload with progress tracking, retry logic, and rate limiting.

## Features

- Drag-and-drop files from your browser
- Upload from filesystem paths (recursive directory scan)
- Upload from URLs
- Multipart upload for large files with chunk-level retry
- Real-time progress bars with speed and ETA
- Configurable parallel upload slots (1 to 12)
- CMP folder selection with breadcrumb paths
- Rate limiting (6 req/s, below the 8/s API limit) with 429 backoff
- Virtualized console log (handles 50,000+ entries)
- CSV export of upload results with Asset IDs
- Browser tab title shows upload progress
- Warns before closing tab during active uploads

## Prerequisites

- Node.js 20 or later
- An Optimizely CMP account with API credentials (Client ID and Client Secret)

### Getting CMP API Credentials

1. Log in to your Optimizely CMP account
2. Navigate to Settings > API Clients
3. Create a new API client with the "Client Credentials" grant type
4. Copy the Client ID and Client Secret

## Quick Start

### Option 1. Run with Node.js

```bash
# Clone and install
git clone <repository-url>
cd cmp-dam-bulk-uploader
npm install

# Build and start
npm run build
npm start
```

Open http://localhost:3000 in your browser.

### Option 2. Run with npx (after publishing)

```bash
npx cmp-dam-bulk-uploader
```

### Option 3. Run with Docker

```bash
docker build -t cmp-bulk-uploader .
docker run -p 3000:3000 cmp-bulk-uploader
```

Open http://localhost:3000 in your browser.

### Option 4. Run with Docker and filesystem access

To upload files from local paths inside the container, mount the directory.

```bash
docker run -p 3000:3000 -v /path/to/files:/data cmp-bulk-uploader
```

Then use `/data` as the path prefix in the "From Path" tab.

## Usage

1. Enter your CMP Client ID and Client Secret on the login screen
2. Select a target folder from the dropdown (optional, defaults to root)
3. Add files using one of three methods.
   - **Drop Files** tab for drag-and-drop from your computer
   - **From URLs** tab for pasting download URLs (one per line)
   - **From Path** tab for scanning a local directory
4. Adjust parallel upload slots if needed (default is 6)
5. Click "Start Upload"
6. Monitor progress in the upload queue and console log
7. Download the CSV report when complete

## Upload Behavior

- Files smaller than 5 MB use standard single-request upload
- Files 5 MB and larger use multipart upload with dynamic chunk sizing
- Each chunk retries up to 3 times with exponential backoff
- Failed files can be retried individually from the queue
- Presigned URLs expire after 60 minutes. Very large files that exceed this window will show a warning

## Configuration

Environment variables.

| Variable | Default | Description |
|----------|---------|-------------|
| PORT | 3000 | Server port |
| HOST | localhost | Server hostname |

## Architecture

The application is a Next.js app that runs entirely on your local machine. All CMP API calls go through the Next.js backend because the CMP token endpoint blocks browser CORS requests.

The browser handles UI, queue management, and orchestration. The backend handles authentication, presigned URL generation, chunk proxying for browser uploads, and direct filesystem/URL streaming for path and URL based uploads.

See ARCHITECTURE.md for detailed design decisions.

## Troubleshooting

**"Token endpoint BLOCKS browser CORS" or network errors on login**
This is expected. All API calls go through the backend proxy. Make sure the Next.js server is running.

**Upload stalls or times out**
Presigned URLs expire after 60 minutes. For extremely large files on slow connections, the upload may fail. Try reducing the number of parallel slots to dedicate more bandwidth per file.

**429 Too Many Requests**
The app automatically handles rate limiting with exponential backoff. If you see frequent 429 errors in the console, reduce parallel slots.

**Port 3000 is already in use**
Set a different port. `PORT=3001 npm start`

**Docker: Cannot access filesystem paths**
Mount the directory containing your files. See the Docker with filesystem access section above.

## License

MIT
