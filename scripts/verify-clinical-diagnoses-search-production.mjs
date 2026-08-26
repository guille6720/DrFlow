/**
 * Verify production DB is configured for diagnosis search (grants, RLS, RPC body).
 *
 *   $env:ALLOW_PRODUCTION_DB="1"
 *   $env:CONFIRM_PRODUCTION_DB="nipqdarduknydqptqzup"
 *   $env:DATABASE_URL="postgresql://postgres:...@db.nipqdarduknydqptqzup.supabase.co:5432/postgres"
 *   node scripts/verify-clinical-diagnoses-search-production.mjs
 */
import { PRODUCTION_REF } from "./supabase-project-refs.mjs";
import { queryJson } from "./lib/exec-sql-file.mjs";

function fail(msg) {
  console.error(`\nERROR: ${msg}\n`);
  process.exit(1);
}

function assertProductionEnv() {
  if (process.env.ALLOW_PRODUCTION_DB !== "1") fail(`Set ALLOW_PRODUCTION_DB=1`);
  if (process.env.CONFIRM_PRODUCTION_DB !== PRODUCTION_REF) {
    fail(`Set CONFIRM_PRODUCTION_DB=${PRODUCTION_REF}`);
  }
  const dbUrl = process.env.DATABASE_URL?.trim();
  if (!dbUrl?.includes(PRODUCTION_REF)) fail("Set DATABASE_URL to production Postgres.");
  return dbUrl;
}

const dbUrl = assertProductionEnv();

const [policy] = await queryJson(
  dbUrl,
  `SELECT pol.polname, pg_get_expr(pol.polqual, pol.polrelid) AS using_expr, pol.polroles::regrole[] AS roles
   FROM pg_policy pol
   JOIN pg_class cls ON cls.oid = pol.polrelid
   JOIN pg_namespace n ON n.oid = cls.relnamespace
   WHERE n.nspname = 'public' AND cls.relname = 'clinical_diagnoses' AND pol.polname = 'clinical_diagnoses_select';`
);

const grants = await queryJson(
  dbUrl,
  `SELECT grantee::regrole::text AS grantee, privilege_type
   FROM information_schema.routine_privileges
   WHERE routine_schema = 'public' AND routine_name = 'search_clinical_diagnoses'
   ORDER BY grantee, privilege_type;`
);

const [rpcCheck] = await queryJson(
  dbUrl,
  `SELECT pg_get_functiondef(p.oid) AS def
   FROM pg_proc p
   JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND p.proname = 'search_clinical_diagnoses'
   LIMIT 1;`
);

const [counts] = await queryJson(
  dbUrl,
  `SELECT
     count(*) FILTER (WHERE source = 'cie10-es-lista-tabular-enfermedades-pdf')::int AS cie10,
     count(*) FILTER (WHERE active)::int AS active_total
   FROM clinical_diagnoses;`
);

const policyUsesIsSuperadminFn = /is_superadmin\s*\(\s*\)/.test(policy?.using_expr ?? "");
const policyUsesProfiles = /profiles/.test(policy?.using_expr ?? "");
const rpcAllowsServiceRole = /service_role/.test(rpcCheck?.def ?? "");
const authenticatedExecute = grants.some(
  (g) => g.grantee === "authenticated" && g.privilege_type === "EXECUTE"
);

const report = {
  target: PRODUCTION_REF,
  cie10_rows: counts?.cie10 ?? 0,
  active_rows: counts?.active_total ?? 0,
  rls_policy: policy?.using_expr ?? null,
  rls_uses_is_superadmin_fn: policyUsesIsSuperadminFn,
  rls_uses_profiles_subquery: policyUsesProfiles,
  rpc_grants: grants,
  authenticated_can_execute_rpc: authenticatedExecute,
  rpc_allows_service_role: rpcAllowsServiceRole,
  migration_145_ok: !policyUsesIsSuperadminFn && policyUsesProfiles && authenticatedExecute,
  app_checklist: [
    "NEXT_PUBLIC_SUPABASE_URL must be https://nipqdarduknydqptqzup.supabase.co",
    "SUPABASE_SERVICE_ROLE_KEY must be set on Vercel Production",
    "Deploy clinical-diagnoses.ts admin-client fix (not yet on prod if search still fails)",
  ],
};

console.log(JSON.stringify(report, null, 2));
process.exit(report.migration_145_ok && report.cie10_rows >= 600 ? 0 : 1);
