/**
 * Verifica /api/health y /api/version (local o producción).
 * Uso:
 *   node scripts/check-health.mjs
 *   node scripts/check-health.mjs --url=https://drflow.opusorg.com
 *   node scripts/check-health.mjs --strict
 */
import { loadEnv, readArg } from "./_env.mjs";

function parseBaseUrl() {
  const fromArg = readArg("--url");
  if (fromArg) return fromArg.replace(/\/$/, "");

  const env = loadEnv({ required: false });
  const fromEnv =
    process.env.HEALTH_CHECK_URL ||
    env.HEALTH_CHECK_URL ||
    env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXT_PUBLIC_SITE_URL;

  if (fromEnv) return fromEnv.replace(/\/$/, "");
  return "http://127.0.0.1:3000";
}

async function fetchJson(url) {
  const res = await fetch(url, { cache: "no-store" });
  const text = await res.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    if (text.trimStart().startsWith("<!DOCTYPE") || text.trimStart().startsWith("<html")) {
      throw new Error(
        `Respuesta HTML en ${url} — ¿deploy pendiente o ruta /api bloqueada? (HTTP ${res.status})`
      );
    }
    throw new Error(`Respuesta no JSON (${res.status}) en ${url}: ${text.slice(0, 120)}`);
  }
  return { res, body };
}

function assertHealthShape(body) {
  if (typeof body.ok !== "boolean") throw new Error("health.ok ausente");
  if (typeof body.version !== "string") throw new Error("health.version ausente");
  if (!body.checks?.supabase) throw new Error("health.checks.supabase ausente");
  if (!body.checks?.memory) throw new Error("health.checks.memory ausente");
}

function assertVersionShape(body) {
  if (typeof body.version !== "string") throw new Error("version.version ausente");
  if (typeof body.title !== "string") throw new Error("version.title ausente");
  if (!Array.isArray(body.highlights)) throw new Error("version.highlights ausente");
}

async function main() {
  const baseUrl = parseBaseUrl();
  const strict = process.argv.includes("--strict");

  console.log(`\n🏥 DrFlow — Health check\n→ ${baseUrl}\n`);

  const healthUrl = `${baseUrl}/api/health`;
  const versionUrl = `${baseUrl}/api/version`;

  const { res: healthRes, body: health } = await fetchJson(healthUrl);
  assertHealthShape(health);

  const { res: versionRes, body: version } = await fetchJson(versionUrl);
  assertVersionShape(version);

  console.log(`✓ GET /api/health → HTTP ${healthRes.status} · ok=${health.ok}`);
  console.log(
    `  supabase=${health.checks.supabase.ok ? "OK" : "FAIL"}` +
      (health.checks.supabase.latencyMs != null
        ? ` · ${health.checks.supabase.latencyMs}ms`
        : "")
  );
  console.log(
    `  memory=${health.checks.memory.heapUsedMb}/${health.checks.memory.heapTotalMb} MB`
  );
  console.log(`✓ GET /api/version → HTTP ${versionRes.status} · v${version.version}`);

  if (strict && !health.ok) {
    console.error("\n❌ Health degradado (--strict)\n");
    process.exit(1);
  }

  if (!health.ok) {
    console.log("\n⚠ Health respondió pero ok=false (modo no estricto)\n");
    process.exit(0);
  }

  console.log("\n✅ Health check OK\n");
}

main().catch((err) => {
  console.error(`\n❌ ${err.message}\n`);
  process.exit(1);
});
