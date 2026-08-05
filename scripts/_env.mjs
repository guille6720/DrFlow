import { existsSync, readFileSync } from "fs";
import { resolve } from "path";

/**
 * Loads KEY=VALUE pairs from .env.local (no dotenv dependency).
 * @param {{ required?: boolean }} options
 */
export function loadEnv({ required = true } = {}) {
  const path = resolve(process.cwd(), ".env.local");
  if (!existsSync(path)) {
    if (required) {
      console.error("❌ No existe .env.local — copiá .env.example y completá las claves.");
      process.exit(1);
    }
    return {};
  }

  const raw = readFileSync(path, "utf8");
  const env = {};
  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const m = trimmed.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
  }
  return env;
}

/** Reads a flag value from argv (`--url=http://...`). */
export function readArg(prefix) {
  const hit = process.argv.find((arg) => arg.startsWith(`${prefix}=`));
  return hit ? hit.slice(prefix.length + 1) : undefined;
}
