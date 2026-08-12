import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(import.meta.url);
const [command, ...args] = process.argv.slice(2);

if (!command) {
  console.error("Usage: node scripts/run-next.mjs <dev|build|start|lint>");
  process.exit(1);
}

// Windows local builds use a temp distDir to avoid OneDrive reparse points.
// NODE_PATH lets Node resolve React and Next dependencies from that external
// generated directory. It is harmless on Linux/Vercel.
const workspaceNodeModules = path.join(process.cwd(), "node_modules");
const nodePathEntries = [
  ...(process.env.NODE_PATH ? process.env.NODE_PATH.split(path.delimiter) : []),
  workspaceNodeModules,
].filter(Boolean);
const env = {
  ...process.env,
  NODE_PATH: [...new Set(nodePathEntries)].join(path.delimiter),
};

const child = spawn(
  process.execPath,
  [require.resolve("next/dist/bin/next"), command, ...args],
  { stdio: "inherit", env },
);

child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  else process.exit(code ?? 1);
});
