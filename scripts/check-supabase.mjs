/**
 * Verifica conexión y estado de Supabase para DrFlow.
 * Uso: node scripts/check-supabase.mjs
 */
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";

function loadEnv() {
  const path = resolve(process.cwd(), ".env.local");
  if (!existsSync(path)) {
    console.error("❌ No existe .env.local — copiá .env.example y completá las claves.");
    process.exit(1);
  }
  const raw = readFileSync(path, "utf8");
  const env = {};
  for (const line of raw.split("\n")) {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m) env[m[1]] = m[2].trim();
  }
  return env;
}

const CHECKS = [
  { table: "clinics", min: 1, label: "Clínicas" },
  { table: "professionals", min: 1, label: "Profesionales demo" },
  { table: "patients", min: 1, label: "Pacientes demo" },
  { table: "public_booking_links", min: 1, label: "Links públicos" },
  { table: "availability_rules", min: 1, label: "Reglas de disponibilidad" },
];

async function main() {
  const env = loadEnv();
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const anon =
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const service = env.SUPABASE_SERVICE_ROLE_KEY;

  console.log("\n🔍 DrFlow — Diagnóstico Supabase\n");

  if (!url || !anon || url.includes("placeholder") || anon.includes("placeholder")) {
    console.log("❌ .env.local sin claves válidas.");
    console.log("   Completá NEXT_PUBLIC_SUPABASE_URL y una de:");
    console.log("   - NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (nueva)");
    console.log("   - NEXT_PUBLIC_SUPABASE_ANON_KEY (legacy)\n");
    process.exit(1);
  }

  console.log(`✓ URL: ${url}`);
  console.log(`✓ Anon key: ${anon.slice(0, 12)}...`);
  console.log(service ? "✓ Service role: configurada" : "⚠ Service role: no configurada (no es obligatoria)");

  // Auth health
  const health = await fetch(`${url}/auth/v1/health`, {
    headers: { apikey: anon },
  });
  console.log(health.ok ? "✓ Auth API responde" : `❌ Auth API: ${health.status}`);

  let allOk = true;
  const apiKey = service ?? anon;
  const authHeader = service ? `Bearer ${service}` : `Bearer ${anon}`;

  for (const { table, min, label } of CHECKS) {
    const res = await fetch(`${url}/rest/v1/${table}?select=id&limit=1`, {
      headers: {
        apikey: apiKey,
        Authorization: authHeader,
        Prefer: "count=exact",
      },
    });

    if (res.status === 404 || res.status === 406) {
      const body = await res.text();
      if (body.includes("does not exist") || body.includes("relation")) {
        console.log(`❌ Tabla '${table}' no existe — faltan migraciones SQL`);
        allOk = false;
        continue;
      }
    }

    const range = res.headers.get("content-range");
    const count = range ? parseInt(range.split("/")[1] ?? "0", 10) : null;

    if (!res.ok) {
      console.log(`❌ ${label} (${table}): HTTP ${res.status}`);
      allOk = false;
    } else if (count !== null && count < min) {
      const hint =
        table === "patients" && !service
          ? " — agregá SUPABASE_SERVICE_ROLE_KEY a .env.local para verificar, o revisá en SQL Editor"
          : " — ¿corriste 003 y 004?";
      console.log(`⚠ ${label}: ${count} filas (esperado ≥ ${min})${hint}`);
      allOk = false;
    } else {
      console.log(`✓ ${label}: ${count ?? "?"} filas`);
    }
  }

  // RPC pública
  const rpc = await fetch(`${url}/rest/v1/rpc/submit_public_booking`, {
    method: "POST",
    headers: {
      apikey: anon,
      Authorization: `Bearer ${anon}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({}),
  });
  const rpcBody = await rpc.text();
  if (rpc.status === 404) {
    console.log("❌ Función submit_public_booking no existe — corré migración 004");
    allOk = false;
  } else if (rpc.status === 400 || rpcBody.includes("invalid") || rpcBody.includes("Link")) {
    console.log("✓ RPC submit_public_booking existe (respondió con error de validación esperado)");
  } else {
    console.log(`⚠ RPC submit_public_booking: HTTP ${rpc.status}`);
  }

  console.log(allOk ? "\n✅ Supabase listo para DrFlow\n" : "\n⚠ Hay pendientes — revisá migraciones en docs/LOCAL_SETUP.md\n");
  process.exit(allOk ? 0 : 1);
}

main().catch((e) => {
  console.error("❌ Error de red:", e.message);
  process.exit(1);
});
