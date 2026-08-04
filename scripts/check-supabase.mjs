/**
 * Verifica conexión y estado de Supabase para DrFlow.
 * Uso: node scripts/check-supabase.mjs
 */
import { loadEnv } from "./_env.mjs";

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

  const schemaKey = service ?? anon;
  const schemaAuth = service ? `Bearer ${service}` : `Bearer ${anon}`;

  const schemaRes = await fetch(
    `${url}/rest/v1/clinics?select=id,accepted_coverages,trial_ends_at&limit=1`,
    {
      headers: {
        apikey: schemaKey,
        Authorization: schemaAuth,
      },
    }
  );
  const schemaBody = await schemaRes.text();
  if (schemaRes.status === 400) {
    if (schemaBody.includes("accepted_coverages")) {
      console.log("❌ Columna accepted_coverages — migración 030 pendiente");
      allOk = false;
    }
    if (schemaBody.includes("trial_ends_at")) {
      console.log("❌ Columna trial_ends_at — migración 032 pendiente");
      allOk = false;
    }
  } else if (schemaRes.ok) {
    console.log("✓ Esquema P0: accepted_coverages + trial_ends_at");
  } else {
    console.log(`⚠ Verificación esquema clinics: HTTP ${schemaRes.status}`);
  }

  const planRes = await fetch(`${url}/rest/v1/patients?select=id,insurance_plan&limit=1`, {
    headers: {
      apikey: schemaKey,
      Authorization: schemaAuth,
    },
  });
  const planBody = await planRes.text();
  if (planRes.status === 400 && planBody.includes("insurance_plan")) {
    console.log("❌ Columna patients.insurance_plan — migración 041 pendiente");
    allOk = false;
  } else if (planRes.ok) {
    console.log("✓ Columna patients.insurance_plan");
  } else {
    console.log(`⚠ Verificación insurance_plan: HTTP ${planRes.status}`);
  }

  const profileRes = await fetch(
    `${url}/rest/v1/patient_clinical_profiles?select=patient_id&limit=1`,
    {
      headers: {
        apikey: schemaKey,
        Authorization: schemaAuth,
      },
    }
  );
  if (profileRes.status === 404 || profileRes.status === 406) {
    const body = await profileRes.text();
    if (body.includes("does not exist") || body.includes("relation")) {
      console.log("❌ Tabla patient_clinical_profiles — migración 047 pendiente");
      allOk = false;
    }
  } else if (profileRes.ok) {
    console.log("✓ Tabla patient_clinical_profiles (Fase 10)");
  } else {
    console.log(`⚠ Verificación patient_clinical_profiles: HTTP ${profileRes.status}`);
  }

  const auditRes = await fetch(
    `${url}/rest/v1/audit_logs?select=id,patient_id,old_values,new_values&limit=1`,
    {
      headers: {
        apikey: schemaKey,
        Authorization: schemaAuth,
      },
    }
  );
  const auditBody = await auditRes.text();
  if (auditRes.status === 400 && auditBody.includes("patient_id")) {
    console.log("❌ Columnas audit_logs Phase 12 — migración 048 pendiente");
    allOk = false;
  } else if (auditRes.ok) {
    console.log("✓ Auditoría Phase 12 (audit_logs.patient_id)");
  } else if (auditRes.status === 404 || auditRes.status === 406) {
    console.log("⚠ Tabla audit_logs no accesible vía REST");
  } else {
    console.log(`⚠ Verificación audit_logs Phase 12: HTTP ${auditRes.status}`);
  }

  const pluginsRes = await fetch(
    `${url}/rest/v1/clinic_plugins?select=clinic_id,plugin_id,enabled&limit=1`,
    {
      headers: {
        apikey: schemaKey,
        Authorization: schemaAuth,
      },
    }
  );
  if (pluginsRes.status === 404 || pluginsRes.status === 406) {
    const body = await pluginsRes.text();
    if (body.includes("does not exist") || body.includes("relation")) {
      console.log("❌ Tabla clinic_plugins — migración 049 pendiente");
      allOk = false;
    }
  } else if (pluginsRes.ok) {
    console.log("✓ Plugins Phase 13 (clinic_plugins)");
  } else {
    console.log(`⚠ Verificación clinic_plugins: HTTP ${pluginsRes.status}`);
  }

  const flagsRes = await fetch(
    `${url}/rest/v1/clinic_feature_flags?select=clinic_id,flag_id,enabled&limit=1`,
    {
      headers: {
        apikey: schemaKey,
        Authorization: schemaAuth,
      },
    }
  );
  if (flagsRes.status === 404 || flagsRes.status === 406) {
    const body = await flagsRes.text();
    if (body.includes("does not exist") || body.includes("relation")) {
      console.log("❌ Tabla clinic_feature_flags — migración 050 pendiente");
      allOk = false;
    }
  } else if (flagsRes.ok) {
    console.log("✓ Feature flags Phase 14 (clinic_feature_flags)");
  } else {
    console.log(`⚠ Verificación clinic_feature_flags: HTTP ${flagsRes.status}`);
  }

  const jobsRes = await fetch(
    `${url}/rest/v1/clinic_jobs?select=clinic_id,job_type,status&limit=1`,
    {
      headers: {
        apikey: schemaKey,
        Authorization: schemaAuth,
      },
    }
  );
  if (jobsRes.status === 404 || jobsRes.status === 406) {
    const body = await jobsRes.text();
    if (body.includes("does not exist") || body.includes("relation")) {
      console.log("❌ Tabla clinic_jobs — migración 051 pendiente");
      allOk = false;
    }
  } else if (jobsRes.ok) {
    console.log("✓ Job queue Phase 15 (clinic_jobs)");
  } else {
    console.log(`⚠ Verificación clinic_jobs: HTTP ${jobsRes.status}`);
  }

  const obsRes = await fetch(
    `${url}/rest/v1/clinic_observability_events?select=clinic_id,category,status&limit=1`,
    {
      headers: {
        apikey: schemaKey,
        Authorization: schemaAuth,
      },
    }
  );
  if (obsRes.status === 404 || obsRes.status === 406) {
    const body = await obsRes.text();
    if (body.includes("does not exist") || body.includes("relation")) {
      console.log("❌ Tabla clinic_observability_events — migración 052 pendiente");
      allOk = false;
    }
  } else if (obsRes.ok) {
    console.log("✓ Observability Phase 16 (clinic_observability_events)");
  } else {
    console.log(`⚠ Verificación clinic_observability_events: HTTP ${obsRes.status}`);
  }

  // RPC pública (404 = no expuesta; 400/500 con mensaje de negocio = existe)
  const rpc = await fetch(`${url}/rest/v1/rpc/submit_public_booking`, {
    method: "POST",
    headers: {
      apikey: anon,
      Authorization: `Bearer ${anon}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      p_slug: "__drflow_check__",
      p_professional_id: "00000000-0000-0000-0000-000000000001",
      p_start_at: new Date(Date.now() + 86_400_000).toISOString(),
      p_first_name: "Test",
      p_last_name: "Check",
      p_document_number: "00000000",
      p_phone: "0000",
    }),
  });
  const rpcBody = await rpc.text();
  if (rpc.status === 404 || rpcBody.includes("PGRST202")) {
    console.log("❌ Función submit_public_booking no existe — corré 010_repair_demo_and_rpc.sql");
    allOk = false;
  } else if (
    rpc.status === 400 ||
    rpc.status === 500 ||
    rpcBody.includes("Link") ||
    rpcBody.includes("inválido") ||
    rpcBody.includes("invalid")
  ) {
    console.log("✓ RPC submit_public_booking existe (respondió con error de validación esperado)");
  } else {
    console.log(`⚠ RPC submit_public_booking: HTTP ${rpc.status} — ${rpcBody.slice(0, 120)}`);
  }

  const occ = await fetch(`${url}/rest/v1/rpc/get_public_booking_occupancy`, {
    method: "POST",
    headers: {
      apikey: anon,
      Authorization: `Bearer ${anon}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      p_slug: "__drflow_check__",
      p_professional_id: "00000000-0000-0000-0000-000000000001",
    }),
  });
  const occBody = await occ.text();
  if (occ.status === 404 || occBody.includes("PGRST202")) {
    console.log("❌ Función get_public_booking_occupancy no existe — migración 045 pendiente (npx supabase db push)");
    allOk = false;
  } else {
    console.log("✓ RPC get_public_booking_occupancy existe");
  }

  console.log(allOk ? "\n✅ Supabase listo para DrFlow\n" : "\n⚠ Hay pendientes — revisá migraciones en docs/LOCAL_SETUP.md\n");
  process.exit(allOk ? 0 : 1);
}

main().catch((e) => {
  console.error("❌ Error de red:", e.message);
  process.exit(1);
});
