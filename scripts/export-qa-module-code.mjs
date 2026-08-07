#!/usr/bin/env node
/**
 * Exporta el código fuente de un módulo QA (todas las capas o una sola).
 *
 * Uso:
 *   node scripts/export-qa-module-code.mjs auth
 *   node scripts/export-qa-module-code.mjs pacientes --layer=business
 *   node scripts/export-qa-module-code.mjs --list
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");

/** @type {Record<string, Record<string, string[]>>} */
const MODULE_FILES = {
  auth: {
    auth: [
      "src/middleware.ts",
      "src/core/supabase/middleware.ts",
      "src/core/auth/session.ts",
      "src/core/auth/session.server.ts",
      "src/core/auth/session.actions.ts",
      "src/app/api/auth/login/route.ts",
      "src/app/api/auth/bootstrap/route.ts",
      "src/app/api/auth/signout/route.ts",
      "src/app/auth/callback/route.ts",
      "src/app/auth/confirm/route.ts",
    ],
    business: [
      "src/lib/actions/auth.ts",
      "src/lib/actions/account.ts",
      "src/core/hooks/use-login-form.ts",
      "src/core/hooks/use-register-clinic-form.ts",
    ],
    data: [
      "src/core/supabase/server.ts",
      "src/core/supabase/client.ts",
      "src/core/supabase/env.ts",
      "src/core/validations/schemas.ts",
      "src/types/database.ts",
    ],
    ui: [
      "src/app/(auth)/login/page.tsx",
      "src/app/(auth)/register/page.tsx",
      "src/core/components/auth/login-form-view.tsx",
      "src/core/components/auth/register-clinic-form.tsx",
      "src/core/components/auth/google-login-button.tsx",
    ],
  },
  permissions: {
    auth: [
      "src/core/actions/clinic-guard.ts",
      "src/core/security/ownership-guard.ts",
      "src/core/security/tenant-scope.ts",
    ],
    business: [
      "src/core/permissions/roles.ts",
      "src/core/permissions/member-permissions.ts",
      "src/core/services/clinical-access.service.ts",
      "src/lib/actions/team-permissions.ts",
    ],
    data: ["src/core/validations/staff-schemas.ts", "src/types/database.ts"],
    ui: [
      "src/features/configuracion/components/configuracion/team-permissions-matrix.tsx",
      "src/core/components/layout/sidebar-nav-content.tsx",
    ],
  },
  pacientes: {
    business: [
      "src/features/pacientes/actions/patients.ts",
      "src/features/pacientes/services/patients.service.ts",
      "src/features/pacientes/server/load-patient-workspace-page.ts",
      "src/features/pacientes/hooks/use-patient-workspace-actions.ts",
      "src/features/pacientes/utils/patient-workspace-tab-routing.ts",
    ],
    data: [
      "src/features/pacientes/repositories/patients.repository.ts",
      "src/core/validations/schemas.ts",
      "src/types/database.ts",
    ],
    ui: [
      "src/app/(dashboard)/pacientes/page.tsx",
      "src/app/(dashboard)/pacientes/[id]/page.tsx",
      "src/features/pacientes/components/pacientes/patient-workspace-content.tsx",
      "src/features/pacientes/components/pacientes/patient-soap-workspace.tsx",
    ],
  },
  historias: {
    business: [
      "src/features/historias/actions/clinical-records.ts",
      "src/features/historias/services/clinical-records.service.ts",
      "src/features/historias/server/load-historias-page.ts",
      "src/features/historias/hooks/use-nueva-consulta-form.ts",
    ],
    data: ["src/core/validations/schemas.ts", "src/types/database.ts"],
    ui: [
      "src/app/(dashboard)/historias/page.tsx",
      "src/app/(dashboard)/historias/nueva/page.tsx",
      "src/features/historias/components/historias/patient-ehr-view.tsx",
      "src/features/historias/components/historias/historia-detail-content.tsx",
    ],
  },
  recetas: {
    business: [
      "src/features/recetas/actions/medical-orders.ts",
      "src/features/recetas/actions/prescriptions.ts",
      "src/features/recetas/services/medical-orders.service.ts",
      "src/features/recetas/utils/build-medical-order-document-data.ts",
    ],
    data: [
      "src/features/recetas/repositories/medical-orders.repository.ts",
      "src/types/medical-order.ts",
      "src/types/prescription.ts",
      "src/core/validations/medical-order.ts",
    ],
    ui: [
      "src/app/(dashboard)/recetas/page.tsx",
      "src/features/recetas/components/recetas/medical-order-list.tsx",
      "src/features/recetas/components/recetas/medical-order-form.tsx",
      "src/features/recetas/components/recetas/medical-order-preview-sheet.tsx",
    ],
  },
  agenda: {
    business: [
      "src/lib/actions/appointments.ts",
      "src/lib/actions/waiting-room.ts",
      "src/lib/actions/public-booking.ts",
      "src/features/agenda/hooks/use-agenda-view.ts",
    ],
    data: ["src/core/validations/public-booking.ts", "src/types/database.ts"],
    ui: [
      "src/app/(dashboard)/agenda/page.tsx",
      "src/app/(dashboard)/sala-espera/page.tsx",
      "src/features/agenda/components/agenda/agenda-view.tsx",
    ],
  },
  configuracion: {
    business: [
      "src/lib/actions/settings.ts",
      "src/lib/actions/invitations.ts",
      "src/lib/actions/team-permissions.ts",
      "src/lib/actions/clinic-feature-flags.ts",
    ],
    data: [
      "src/features/configuracion/repositories/clinics.repository.ts",
      "src/core/validations/settings-schemas.ts",
      "src/core/validations/staff-schemas.ts",
    ],
    ui: [
      "src/app/(dashboard)/configuracion/page.tsx",
      "src/features/configuracion/components/configuracion/settings-panel.tsx",
      "src/features/configuracion/components/configuracion/team-invite-form-section.tsx",
    ],
  },
  dashboard: {
    business: [
      "src/features/dashboard/server/load-clinical-operations-dashboard.ts",
      "src/features/dashboard/utils/clinical-ops-metrics.ts",
      "src/lib/utils/attendance-stats.ts",
    ],
    data: ["src/features/dashboard/utils/clinical-operations-dashboard-types.ts"],
    ui: [
      "src/app/(dashboard)/dashboard/page.tsx",
      "src/features/dashboard/components/dashboard/clinical-operations-dashboard.tsx",
    ],
  },
  billing: {
    business: [
      "src/core/billing/plans.ts",
      "src/core/trial/clinic-trial.ts",
      "src/lib/actions/cash-register.ts",
    ],
    data: ["src/core/validations/cash-schemas.ts"],
    ui: [
      "src/app/(marketing)/planes/page.tsx",
      "src/core/components/landing/plans-pricing-section.tsx",
      "src/core/components/trial/trial-banner.tsx",
    ],
  },
  portal: {
    business: [
      "src/features/pacientes/actions/patient-app-share.ts",
      "src/features/pacientes/hooks/use-patient-portal.ts",
      "src/lib/server/cached-clinic-metadata.ts",
    ],
    data: ["src/types/database.ts"],
    ui: [
      "src/app/portal/[slug]/page.tsx",
      "src/features/portal/components/portal/patient-portal-view.tsx",
    ],
  },
  ia: {
    business: [
      "src/lib/utils/clinical-copilot.ts",
      "src/lib/utils/clinical-assistant.ts",
      "src/app/api/clinical-ai/route.ts",
      "src/lib/actions/user-ai-connection.ts",
    ],
    data: [
      "src/core/validations/clinical-ai-api.ts",
      "src/features/ia/types/physician-assist-types.ts",
    ],
    ui: [
      "src/features/ia/components/clinical-workflow/clinical-copilot-sheet.tsx",
      "src/features/ia/components/clinical-workflow/inline-physician-assist.tsx",
    ],
  },
  data: {
    data: [
      "src/core/supabase/server.ts",
      "src/core/security/rls-manifest.ts",
      "src/core/security/audit-service.ts",
      "src/core/repositories/types.ts",
      "supabase/migrations/071_clinic_member_permissions_and_shared_ai.sql",
      "supabase/migrations/072_invitation_profile_access.sql",
      "supabase/migrations/073_clinic_invitation_initial_password.sql",
    ],
    business: [
      "src/lib/actions/patient-import.ts",
      "src/lib/actions/hce-import.ts",
      "src/lib/utils/migration-health.ts",
    ],
    ui: [
      "src/app/(dashboard)/datos/page.tsx",
      "src/features/integraciones/components/datos/migration-health-panel.tsx",
    ],
  },
  pami: {
    business: [
      "src/lib/actions/pami-setup.ts",
      "src/lib/hooks/use-pami-planillas.ts",
      "src/features/pami/server/load-pami-planillas-page.ts",
      "src/lib/constants/pami-planillas.ts",
      "src/lib/constants/pami-cabecera.ts",
      "src/lib/actions/pharmacology.ts",
    ],
    data: [
      "supabase/migrations/020_pami_cabecera.sql",
      "supabase/seeds/pami_vademecum_data.sql",
      "src/types/database.ts",
    ],
    ui: [
      "src/app/(dashboard)/pami/planillas/page.tsx",
      "src/app/(dashboard)/guia-pami/page.tsx",
      "src/features/pami/components/pami/pami-planillas-view.tsx",
      "src/features/pacientes/components/pacientes/pami-patient-banner.tsx",
      "src/features/configuracion/components/configuracion/pami-setup-panel.tsx",
    ],
  },
  caja: {
    auth: [
      "src/core/permissions/roles.ts",
      "src/core/actions/clinic-guard.ts",
      "src/core/security/ownership-guard.ts",
    ],
    business: [
      "src/lib/actions/cash-register.ts",
      "src/lib/server/load-revenue-snapshot.ts",
      "src/features/caja/hooks/use-cash-register.ts",
      "src/lib/constants/cash-register.ts",
    ],
    data: [
      "src/core/validations/cash-schemas.ts",
      "supabase/migrations/034_secretaria_caja.sql",
    ],
    ui: [
      "src/app/(dashboard)/caja/page.tsx",
      "src/app/(dashboard)/caja/cierre/page.tsx",
      "src/app/(dashboard)/caja/reportes/page.tsx",
      "src/app/(dashboard)/caja/cuenta-corriente/page.tsx",
      "src/features/caja/components/caja/cash-register-view.tsx",
      "src/features/caja/components/caja/cash-charge-form-section.tsx",
      "src/features/caja/components/caja/cash-closure-view.tsx",
    ],
  },
  profesionales: {
    auth: [
      "src/core/permissions/roles.ts",
      "src/core/actions/guard-adapters.ts",
    ],
    business: [
      "src/lib/actions/professional-intake.ts",
      "src/features/profesionales/hooks/use-professional-intake.ts",
      "src/features/profesionales/hooks/use-clinic-team-member-panel.ts",
      "src/features/profesionales/components/profesionales/professional-intake-utils.ts",
    ],
    data: [
      "src/core/validations/professional-intake.ts",
      "src/core/validations/professional-bank.ts",
      "src/core/validations/settings-schemas.ts",
    ],
    ui: [
      "src/app/(dashboard)/ingreso-profesionales/page.tsx",
      "src/features/profesionales/components/profesionales/professional-intake-view.tsx",
      "src/features/profesionales/components/profesionales/professional-intake-new-form.tsx",
      "src/features/profesionales/components/profesionales/professional-schedule-editor.tsx",
      "src/features/profesionales/components/profesionales/clinic-team-member-detail-panel.tsx",
    ],
  },
  reportes: {
    auth: [
      "src/core/permissions/roles.ts",
      "src/core/auth/dashboard-page.ts",
    ],
    business: [
      "src/lib/server/load-monthly-clinic-report.ts",
      "src/features/dashboard/components/reportes/async-report-button.tsx",
      "src/features/dashboard/components/reportes/export-csv-button.tsx",
    ],
    data: ["src/types/database.ts"],
    ui: ["src/app/(dashboard)/reportes/page.tsx"],
  },
  auditoria: {
    auth: [
      "src/core/permissions/roles.ts",
      "src/features/pacientes/server/load-patient-audit-trail.ts",
    ],
    business: [
      "src/core/security/audit-service.ts",
      "src/core/security/audit-log.ts",
      "src/core/security/audit-context.ts",
      "src/core/auth/session.server.ts",
    ],
    data: [
      "src/core/security/audit-types.ts",
      "src/features/pacientes/constants/patient-workspace-tabs.ts",
    ],
    ui: [
      "src/features/pacientes/components/pacientes/patient-clinical-audit-panel.tsx",
      "src/features/pacientes/components/pacientes/patient-workspace-view.tsx",
      "src/features/historias/components/historias/historia-detail-audit-card.tsx",
    ],
  },
  administracion: {
    auth: [
      "src/core/permissions/roles.ts",
      "src/core/actions/clinic-guard.ts",
    ],
    business: [
      "src/lib/actions/admin-documents.ts",
      "src/lib/actions/waiting-room.ts",
      "src/features/administracion/server/load-atenciones-page.ts",
      "src/lib/utils/attendance-stats.ts",
    ],
    data: [
      "src/core/validations/admin-documents.ts",
      "src/core/validations/cash-schemas.ts",
    ],
    ui: [
      "src/app/(dashboard)/secretaria/documentos/page.tsx",
      "src/app/(dashboard)/sala-espera/page.tsx",
      "src/app/(dashboard)/atenciones/page.tsx",
      "src/features/administracion/components/secretaria/admin-documents-panel.tsx",
      "src/features/administracion/components/secretaria/waiting-room-view.tsx",
      "src/features/administracion/components/atenciones/patient-attendance-register.tsx",
    ],
  },
  pharmacology: {
    auth: [
      "src/core/permissions/roles.ts",
      "src/lib/actions/pharmacology.ts",
    ],
    business: [
      "src/lib/hooks/use-pharmacology-search.ts",
      "src/lib/hooks/use-deferred-pathology-search.ts",
      "src/lib/server/cached-reference-data.ts",
    ],
    data: [
      "src/core/validations/pharmacology-api.ts",
      "src/types/pharmacology.ts",
      "src/app/api/pharmacology/route.ts",
    ],
    ui: [
      "src/app/(dashboard)/herramientas/farmacologia/page.tsx",
      "src/features/pharmacology/components/pharmacology/pharmacology-search-view.tsx",
      "src/features/pharmacology/components/pharmacology/pharmacology-search-mode-tabs.tsx",
      "src/features/pharmacology/components/pharmacology/vademecum-typeahead.tsx",
    ],
  },
  voice: {
    business: [
      "src/features/voice/lib/voice-input.ts",
      "src/features/voice/hooks/use-speech-to-text.ts",
    ],
    data: ["src/core/validations/settings-schemas.ts"],
    ui: [
      "src/features/voice/components/voice/voice-input-provider.tsx",
      "src/core/components/layout/dashboard-data-shell.tsx",
      "src/components/ui/textarea.tsx",
      "src/features/historias/components/historias/nueva-consulta-form-body.tsx",
    ],
  },
  telemedicina: {
    auth: [
      "src/core/permissions/roles.ts",
      "src/core/actions/clinic-guard.ts",
    ],
    business: [
      "src/lib/actions/clinic-services.ts",
      "src/lib/services/telemedicine.ts",
    ],
    data: ["src/types/database.ts"],
    ui: [
      "src/app/(dashboard)/telemedicina/page.tsx",
      "src/features/telemedicina/components/telemedicina/telemedicina-view.tsx",
    ],
  },
  facturacion: {
    auth: [
      "src/core/permissions/roles.ts",
      "src/core/actions/clinic-guard.ts",
      "src/core/security/ownership-guard.ts",
    ],
    business: [
      "src/lib/actions/clinic-services.ts",
      "src/lib/services/payments.ts",
      "src/shared/utils/currency.ts",
    ],
    data: ["src/types/database.ts"],
    ui: [
      "src/app/(dashboard)/pagos/page.tsx",
      "src/features/facturacion/components/pagos/pagos-view.tsx",
    ],
  },
};

const LAYER_LABELS = {
  auth: "Autenticación / guards",
  business: "Lógica de negocio / servicios",
  data: "Capa de datos / validación",
  ui: "Interfaz / componentes",
};

function listModules() {
  console.log("Módulos disponibles:");
  for (const id of Object.keys(MODULE_FILES)) {
    const layers = Object.keys(MODULE_FILES[id]).join(", ");
    console.log(`  ${id} (${layers})`);
  }
}

function exportModule(moduleId, layerFilter) {
  const mod = MODULE_FILES[moduleId];
  if (!mod) {
    console.error(`Módulo desconocido: ${moduleId}`);
    listModules();
    process.exit(1);
  }

  const outDir = path.join(ROOT, "docs", "qa-exports");
  fs.mkdirSync(outDir, { recursive: true });

  const layers = layerFilter ? { [layerFilter]: mod[layerFilter] } : mod;
  if (layerFilter && !mod[layerFilter]) {
    console.error(`Capa desconocida: ${layerFilter}`);
    process.exit(1);
  }

  for (const [layer, files] of Object.entries(layers)) {
    const parts = [];
    parts.push(`# DrFlow QA — módulo ${moduleId} / capa ${layer}`);
    parts.push(`# ${LAYER_LABELS[layer] ?? layer}`);
    parts.push(`# Generado: ${new Date().toISOString()}`);
    parts.push("");

    for (const rel of files) {
      const abs = path.join(ROOT, rel);
      parts.push(`\n${"=".repeat(72)}\n// FILE: ${rel}\n${"=".repeat(72)}\n`);
      if (fs.existsSync(abs)) {
        parts.push(fs.readFileSync(abs, "utf8"));
      } else {
        parts.push(`// [ARCHIVO NO ENCONTRADO: ${rel}]`);
      }
    }

    const outFile = path.join(outDir, `${moduleId}-${layer}.md`);
    fs.writeFileSync(outFile, parts.join("\n"), "utf8");
    console.log(`Escrito: ${path.relative(ROOT, outFile)} (${files.length} archivos)`);
  }
}

const args = process.argv.slice(2);
const listFlag = args.includes("--list");
const layerArg = args.find((a) => a.startsWith("--layer="));
const layerFilter = layerArg ? layerArg.split("=")[1] : null;
const moduleId = args.find((a) => !a.startsWith("--"));

if (listFlag || !moduleId) {
  listModules();
  process.exit(0);
}

exportModule(moduleId, layerFilter);
