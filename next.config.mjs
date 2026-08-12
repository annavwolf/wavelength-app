import os from "node:os";
import path from "node:path";

// OneDrive Files On-Demand turns generated files inside this workspace —
// including node_modules/.cache — into Windows reparse points. Next calls
// readlink while clearing those files and fails with EINVAL. Keep generated
// output in the regular Windows temp directory instead. scripts/run-next.mjs
// supplies NODE_PATH so generated server bundles can resolve this project's
// dependencies. Linux/Vercel builds retain .next.
// Next resolves distDir from the project root, so use a relative path even
// though the destination itself is outside the OneDrive workspace.
const distDir = process.platform === "win32"
  ? path.relative(process.cwd(), path.join(os.tmpdir(), "otis-next-cache"))
  : ".next";

/** @type {import('next').NextConfig} */
const nextConfig = { distDir };

export default nextConfig;
