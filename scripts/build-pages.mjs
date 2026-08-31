import { spawnSync } from "node:child_process";
import { existsSync, renameSync } from "node:fs";

const localApiDirectory = "app/api";
const parkedApiDirectory = "work/pages-build-api";
const hasLocalApi = existsSync(localApiDirectory);

if (hasLocalApi) renameSync(localApiDirectory, parkedApiDirectory);
try {
  const result = spawnSync(process.execPath, ["node_modules/next/dist/bin/next", "build"], {
    stdio: "inherit",
    env: { ...process.env, CLOUDFLARE_PAGES: "true" },
  });
  process.exitCode = result.status ?? 1;
} finally {
  if (hasLocalApi) renameSync(parkedApiDirectory, localApiDirectory);
}
