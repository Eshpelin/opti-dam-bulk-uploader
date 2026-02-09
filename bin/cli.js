#!/usr/bin/env node

const { execSync, spawn } = require("child_process");
const path = require("path");
const fs = require("fs");

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || "localhost";

// Locate the standalone server
const standaloneServer = path.join(__dirname, "..", ".next", "standalone", "server.js");

if (!fs.existsSync(standaloneServer)) {
  console.error("Error: Build output not found. Run 'npm run build' first.");
  process.exit(1);
}

console.log(`Starting CMP DAM Bulk Uploader on http://${HOST}:${PORT}`);

// Start the Next.js standalone server
const server = spawn(process.execPath, [standaloneServer], {
  env: {
    ...process.env,
    PORT: String(PORT),
    HOSTNAME: HOST,
  },
  stdio: "inherit",
});

// Open the browser after a short delay
setTimeout(() => {
  const url = `http://${HOST}:${PORT}`;
  try {
    const platform = process.platform;
    if (platform === "darwin") {
      execSync(`open "${url}"`);
    } else if (platform === "win32") {
      execSync(`start "" "${url}"`);
    } else {
      execSync(`xdg-open "${url}"`);
    }
  } catch {
    // Browser open failed silently
  }
}, 2000);

server.on("close", (code) => {
  process.exit(code ?? 0);
});

process.on("SIGINT", () => {
  server.kill("SIGINT");
});

process.on("SIGTERM", () => {
  server.kill("SIGTERM");
});
