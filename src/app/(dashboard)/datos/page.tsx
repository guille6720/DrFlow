import { ArrowLeftRight } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";

import { getDashboardPageContext } from "@/core/auth/dashboard-page";
import { Header } from "@/core/components/layout/header";
import { hasPermission } from "@/core/permissions/roles";
import { createClient } from "@/core/supabase/server";

import { ClinicalStructureStatsPanel } from "@/features/historias/components/historias/clinical-structure-stats-panel";
import { loadClinicStructuredClinicalStats } from "@/features/historias/server/load-clinic-structured-clinical-stats";
import { ClearClinicalHistoryPanel, MigrationHealthPanel } from "@/features/integraciones";
import { DataImportExportHub } from "@/features/integraciones/components/datos/data-import-export-hub";
import { DatosNavigationHelp } from "@/features/integraciones/components/datos/datos-navigation-help";
import { loadImportExportHistory } from "@/features/integraciones/server/load-import-export-history";

import { Button } from "@/components/ui/button";
import { SectorHero } from "@/components/ui/sector-hero";
import { getCachedClinicProfessionalsList } from "@/lib/server/cached-clinic-queries";
import { buildMigrationHealthReport, type MigrationHealthReport } from "@/lib/utils/migration-health";
import { getProfessionalDisplayName } from "@/lib/utils/professional";

export const maxDuration = 300;

const MIGRATION_RECORDS_LIMIT = 25_000;

export default async function DatosPage() {
  const { profile, clinics, clinicId, clinic, role, isSuperadmin, permissionOverrides } =
    await getDashboardPageContext();
  const supabase = await createClient();

  const canImportPatients = hasPermission(role, "importPatients", isSuperadmin, permissionOverrides);
  const canImportClinical = hasPermission(
    role,
    "importClinicalRecords",
    isSuperadmin,
    permissionOverrides
  );
  const canExportPatients = hasPermission(role, "exportPatients", isSuperadmin, permissionOverrides);
  const canExportClinical = hasPermission(
    role,
    "exportClinicalRecords",
    isSuperadmin,
    permissionOverrides
  );
  const canBulkExport = hasPermission(role, "bulkExportData", isSuperadmin, permissionOverrides);
  const canResetClinicalHistory = hasPermission(role, "manageClinic", isSuperadmin, permissionOverrides);
  const canViewClinicalStats = hasPermission(
    role,
    "viewClinicalRecords",
    isSuperadmin,
    permissionOverrides
  );

  let patientCount = 0;
  let migrationReport: MigrationHealthReport | null = null;
  let clinicalStats: Awaited<ReturnType<typeof loadClinicStructuredClinicalStats>> = {
    cie10: [],
    treatments: [],
  };
  const history = await loadImportExportHistory(40);
  let professionals: Array<{ id: string; name: string }> = [];
  let insuranceOptions: string[] = [];

  if (clinicId) {
    const [
      { count },
      { data: migrationPatients },
      { data: migrationAttachments },
      { count: migrationRecordCount },
      { data: migrationRecords },
    ] = await Promise.all([
      supabase
        .from("patients")
        .select("id", { count: "exact", head: true })
        .eq("clinic_id", clinicId)
        .eq("is_active", true),
      supabase
        .from("patients")
        .select("id, first_name, last_name, document_number, notes")
        .eq("clinic_id", clinicId)
        .eq("is_active", true),
      supabase
        .from("patient_attachments")
        .select("patient_id, file_name, file_type, category")
        .eq("clinic_id", clinicId),
      supabase
        .from("clinical_records")
        .select("id", { count: "exact", head: true })
        .eq("clinic_id", clinicId),
      supabase
        .from("clinical_records")
        .select("patient_id, chief_complaint, evolution")
        .eq("clinic_id", clinicId)
        .limit(MIGRATION_RECORDS_LIMIT),
    ]);

    patientCount = count ?? 0;
    migrationReport = buildMigrationHealthReport({
      patients: migrationPatients ?? [],
      attachments: migrationAttachments ?? [],
      records: migrationRecords ?? [],
      recordsTruncated: (migrationRecordCount ?? 0) > MIGRATION_RECORDS_LIMIT,
    });

    if (canViewClinicalStats) {
      clinicalStats = await loadClinicStructuredClinicalStats(supabase, clinicId);
    }
    if (canImportClinical || canBulkExport) {
      const rows = await getCachedClinicProfessionalsList(clinicId);
      professionals = rows.map((row) => ({
        id: row.id,
        name: getProfessionalDisplayName(row),
      }));
    }
    if (canBulkExport) {
      const { data: coverageRows } = await supabase
        .from("patients")
        .select("insurance_provider")
        .eq("clinic_id", clinicId)
        .eq("is_active", true)
        .not("insurance_provider", "is", null)
        .limit(2000);
      insuranceOptions = [
        ...new Set(
          (coverageRows ?? [])
            .map((row) => (typeof row.insurance_provider === "string" ? row.insurance_provider.trim() : ""))
            .filter(Boolean)
        ),
      ].sort((a, b) => a.localeCompare(b, "es"));
    }
  }

  return (
    <>
      <Header
        title="Importación y exportación"
        subtitle="Carga masiva y respaldos"
        clinics={clinics}
        activeClinicId={clinicId}
        role={role}
        userName={profile?.full_name}
      />

      <div className="flex flex-col gap-4 p-3 lg:p-4">
        <DatosNavigationHelp />

        <SectorHero
          icon={ArrowLeftRight}
          title="Importar / Exportar datos"
          subtitle="Configuración → Importar / Exportar. Los archivos se tratan como no confiables; la escritura espera confirmación."
        />

        <Suspense fallback={<p className="text-sm text-slate-500">Cargando módulo…</p>}>
          <DataImportExportHub
            canImportPatients={canImportPatients}
            canImportClinical={canImportClinical}
            canExportPatients={canExportPatients}
            canExportClinical={canExportClinical}
            canBulkExport={canBulkExport}
            patientCount={patientCount}
            exportRecords={[]}
            history={history.rows}
            historyError={history.error}
            professionals={professionals}
            insuranceOptions={insuranceOptions}
          />
        </Suspense>

        {migrationReport && (canImportPatients || canImportClinical) && (
          <div className="mt-4">
            <MigrationHealthPanel report={migrationReport} />
          </div>
        )}

        {canViewClinicalStats ? (
          <div className="mt-4">
            <ClinicalStructureStatsPanel
              cie10={clinicalStats.cie10}
              treatments={clinicalStats.treatments}
            />
          </div>
        ) : null}

        {canResetClinicalHistory && clinic && (
          <ClearClinicalHistoryPanel clinicName={clinic.name} />
        )}

        <div className="mt-6">
          <Link href="/configuracion?grupo=sistema">
            <Button variant="outline">Volver a Configuración</Button>
          </Link>
        </div>
      </div>
    </>
  );
}
