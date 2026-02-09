import { NextRequest, NextResponse } from "next/server";
import { readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

interface FileEntry {
  name: string;
  path: string;
  size: number;
  relativePath: string | null;
}

function scanDir(dirPath: string, rootPath: string, results: FileEntry[]): void {
  const entries = readdirSync(dirPath, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = join(dirPath, entry.name);

    // Skip hidden files/directories
    if (entry.name.startsWith(".")) continue;

    if (entry.isDirectory()) {
      scanDir(fullPath, rootPath, results);
    } else if (entry.isFile()) {
      try {
        const stats = statSync(fullPath);
        const relativePath =
          dirPath === rootPath ? null : dirPath.substring(rootPath.length + 1);
        results.push({
          name: entry.name,
          path: fullPath,
          size: stats.size,
          relativePath,
        });
      } catch {
        // Skip files we cannot stat (permission errors, etc.)
      }
    }
  }
}

export async function POST(request: NextRequest) {
  try {
    const { directoryPath } = await request.json();

    if (!directoryPath) {
      return NextResponse.json(
        { error: "directoryPath is required" },
        { status: 400 }
      );
    }

    const absPath = resolve(directoryPath);

    // Verify it is a directory
    let stats;
    try {
      stats = statSync(absPath);
    } catch {
      return NextResponse.json(
        { error: `Path not found: ${absPath}` },
        { status: 404 }
      );
    }

    if (!stats.isDirectory()) {
      // It is a single file
      return NextResponse.json({
        files: [
          {
            name: absPath.split("/").pop() ?? absPath,
            path: absPath,
            size: stats.size,
            relativePath: null,
          },
        ],
      });
    }

    const files: FileEntry[] = [];
    scanDir(absPath, absPath, files);

    // Sort by name
    files.sort((a, b) => a.name.localeCompare(b.name));

    return NextResponse.json({ files });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to scan directory";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
