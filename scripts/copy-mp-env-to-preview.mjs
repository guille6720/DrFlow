/**
 * Copy Mercado Pago Production secrets to Preview without printing values.
 * Usage: node scripts/copy-mp-env-to-preview.mjs
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const KEYS = ["MERCADOPAGO_ACCESS_TOKEN", "MERCADOPAGO_WEBHOOK_SECRET", "BILLING_PROVIDER"];

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "drflow-mp-env-"));
const envFile = path.join(tmp, ".env.production.local");

try {
  execFileSync(
    "npx",
    ["vercel", "env", "pull", envFile, "--environment", "production", "--yes"],
    { stdio: ["ignore", "pipe", "pipe"], shell: true }
  );

  const raw = fs.readFileSync(envFile, "utf8");
  /** @type {Record<string, string>} */
  const values = {};
  for (const line of raw.split(/\r?\n/)) {
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq < 0) continue;
    const key = line.slice(0, eq).trim();
    let val = line.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    values[key] = val;
  }

  for (const key of KEYS) {
    const value = values[key];
    if (!value) {
      console.log(`SKIP ${key} (missing in Production)`);
      continue;
    }
    try {
      execFileSync("npx", ["vercel", "env", "rm", key, "preview", "--yes"], {
        stdio: ["ignore", "pipe", "pipe"],
        shell: true,
      });
    } catch {
      /* may not exist yet */
    }
    execFileSync("npx", ["vercel", "env", "add", key, "preview", "--sensitive"], {
      input: `${value}\n`,
      stdio: ["pipe", "pipe", "pipe"],
      shell: true,
    });
    console.log(`OK ${key} → Preview`);
  }
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}
