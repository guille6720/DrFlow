/**
 * Staging report: clinic commercial posture without PHI.
 * Usage: node scripts/report-commercial-clinics-staging.mjs
 * Requires SUPABASE_URL + service role when querying; otherwise prints SQL-only mode.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const sqlPath = resolve(
  "supabase/migrations/rollback/VERIFY_138_commercial_essential_pro_staging.sql"
);

console.log("# Reporte comercial clínicas (sin PHI)");
console.log("");
console.log("Ejecutar en staging (solo lectura):");
console.log("");
console.log(readFileSync(sqlPath, "utf8"));
console.log("");
console.log("Clasificación esperada (manual):");
console.log("- legacy: plan comercial legacy / sin reasignar");
console.log("- trial: trial_ends_at futuro o plan trial");
console.log("- essential/pro: nuevos SKUs facturables");
console.log("- exceso seats: professionals > professionals.max del plan (no borrar)");
console.log("");
console.log("WARNING: storage metering incompleto no autoriza borrar archivos clínicos.");
