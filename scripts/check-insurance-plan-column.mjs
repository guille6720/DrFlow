/**
 * Verifica columna patients.insurance_plan (migración 041 / 034).
 * Uso: node scripts/check-insurance-plan-column.mjs
 */
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";

function loadEnv() {
  const path = resolve(process.cwd(), ".env.local");
  if (!existsSync(path)) {
    console.error("❌ No existe .env.local");
    process.exit(1);
  }
  const env = {};
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m) env[m[1]] = m[2].trim();
  }
  return env;
}

async function main() {
  const env = loadEnv();
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    console.error("❌ Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env.local");
    process.exit(1);
  }

  const res = await fetch(`${url}/rest/v1/patients?select=id,insurance_plan&limit=1`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  });
  const body = await res.text();

  if (res.status === 400 && body.includes("insurance_plan")) {
    console.log("❌ Columna patients.insurance_plan no existe — aplicá migración 041_patients_insurance_plan.sql");
    process.exit(1);
  }

  if (!res.ok) {
    console.log(`⚠ Verificación insurance_plan: HTTP ${res.status} — ${body.slice(0, 120)}`);
    process.exit(1);
  }

  console.log("✓ Columna patients.insurance_plan disponible");
}

main().catch((e) => {
  console.error("❌", e.message);
  process.exit(1);
});
