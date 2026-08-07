#!/usr/bin/env node
/** @deprecated Usar: npx tsx scripts/sync-qa-auditoria-json.ts */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const r = spawnSync("npx", ["tsx", "scripts/sync-qa-auditoria-json.ts"], {
  cwd: ROOT,
  stdio: "inherit",
  shell: true,
});
process.exit(r.status ?? 1);
