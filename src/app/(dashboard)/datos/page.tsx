import { ArrowLeftRight } from "lucide-react";
import Link from "next/link";

import { getDashboardPageContext } from "@/core/auth/dashboard-page";
import { Header } from "@/core/components/layout/header";
import { hasPermission } from "@/core/permissions/roles";
import { createClient } from "@/core/supabase/server";

import { ClinicalStructureStatsPanel } from "@/features/historias/components/historias/clinical-structure-stats-panel";
import { loadClinicStructuredClinicalStats } from "@/features/historias/server/load-clinic-structured-clinical-stats";
import { DataImportExportSidebar } from "@/features/integraciones";
import { MigrationHealthPanel } from "@/features/integraciones";
import { ClearClinicalHistoryPanel } from "@/features/integraciones";
import { DatosBulkDownloadCards } from "@/features/integraciones/components/datos/datos-bulk-download-cards";
import { DatosNavigationHelp } from "@/features/integraciones/components/datos/datos-navigation-help";

import { Button } from "@/components/ui/button";
import { SectorHero } from "@/components/ui/sector-hero";
import type { ClinicalRecordExportRow, PatientExportRow } from "@/lib/utils/clinical-export-client";
import { buildMigrationHealthReport, type MigrationHealthReport } from "@/lib/utils/migration-health";

export const maxDuration = 300;

const EXPORT_PATIENT_LIMIT = 5000;
const EXPORT_RECORDS_LIMIT = 2000;
const MIGRATION_RECORDS_LIMIT = 25_000;

export default async function DatosPage() {
  const { profile, clinics, clinicId, clinic, role, isSuperadmin } = await getDashboardPageContext();
  const supabase = await createClient();

  const canImportPatients = hasPermission(role, "managePatients", isSuperadmin);
  const canImportClinical =
    hasPermission(role, "editClinicalRecords", isSuperadmin) ||
    hasPermission(role, "managePatients", isSuperadmin);
  const canResetClinicalHistory = hasPermission(role, "manageClinic", isSuperadmin);
  const canViewClinicalStats = hasPermission(role, "viewClinicalRecords", isSuperadmin);

  let exportPatients: PatientExportRow[] = [];
  let exportRecords: ClinicalRecordExportRow[] = [];
  let migrationReport: MigrationHealthReport | null = null;
  let clinicalStats: Awaited<ReturnType<typeof loadClinicStructuredClinicalStats>> = {
    cie10: [],
    treatments: [],
  };

  if (clinicId) {
    const [
      { data: patientsData },
      { data: recordsData },
      { data: migrationPatients },
      { data: migrationAttachments },
      { count: migrationRecordCount },
      { data: migrationRecords },
    ] = await Promise.all([
      supabase
        .from("patients")
        .select("first_name, last_name, document_number, birth_date, phone, email, insurance_provider")
        .eq("clinic_id", clinicId)
        .eq("is_active", true)
        .order("last_name")
        .limit(EXPORT_PATIENT_LIMIT),
      supabase
        .from("clinical_records")
        .select(
          "chief_complaint, diagnosis, evolution, indications, created_at, patients(first_name, last_name, document_number), professionals(profiles(full_name))"
        )
        .eq("clinic_id", clinicId)
        .order("created_at", { ascending: false })
        .limit(EXPORT_RECORDS_LIMIT),
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

    exportPatients =
      patientsData?.map((p) => ({
        first_name: p.first_name,
        last_name: p.last_name,
        document_number: p.document_number,
        phone: p.phone ?? "",
        email: p.email ?? "",
        insurance_provider: p.insurance_provider ?? "",
        birth_date: p.birth_date ?? "",
      })) ?? [];

    exportRecords =
      recordsData?.map((r) => {
        const patient = r.patients as unknown as {
          first_name: string;
          last_name: string;
          document_number: string;
        } | null;
        const patientName = patient
          ? `${patient.last_name}, ${patient.first_name}`
          : "Paciente";
        return {
          created_at: r.created_at,
          patient_name: patientName,
          document_number: patient?.document_number ?? "",
          professional_name:
            (r.professionals as { profiles?: { full_name?: string } } | null)?.profiles
              ?.full_name ?? "Profesional",
          chief_complaint: r.chief_complaint ?? "",
          diagnosis: r.diagnosis ?? "",
          evolution: r.evolution ?? "",
          indications: r.indications ?? "",
        };
      }) ?? [];

    migrationReport = buildMigrationHealthReport({
      patients: migrationPatients ?? [],
      attachments: migrationAttachments ?? [],
      records: migrationRecords ?? [],
      recordsTruncated: (migrationRecordCount ?? 0) > MIGRATION_RECORDS_LIMIT,
    });

    if (canViewClinicalStats) {
      clinicalStats = await loadClinicStructuredClinicalStats(supabase, clinicId);
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

      <div className="flex flex-col gap-4 p-3 lg:flex-row lg:items-start lg:p-4">
        <aside className="w-full shrink-0 lg:sticky lg:top-4 lg:w-[min(100%,22rem)] lg:max-w-sm">
          <DataImportExportSidebar
            canImportPatients={canImportPatients}
            canImportClinical={canImportClinical}
            exportPatients={exportPatients}
            exportRecords={exportRecords}
          />
        </aside>

        <main className="min-w-0 flex-1">
          <DatosNavigationHelp />

          <SectorHero
            icon={ArrowLeftRight}
            title="Importación y exportación"
            subtitle="Subí archivos de migración y descargá respaldos en CSV o PDF. La consulta día a día sigue en Pacientes e Historia clínica."
          />

          {migrationReport && (canImportPatients || canImportClinical) && (
            <div className="mb-8">
              <MigrationHealthPanel report={migrationReport} />
            </div>
          )}

          {canViewClinicalStats ? (
            <div className="mb-8">
              <ClinicalStructureStatsPanel
                cie10={clinicalStats.cie10}
                treatments={clinicalStats.treatments}
              />
            </div>
          ) : null}

          {canResetClinicalHistory && clinic && (
            <ClearClinicalHistoryPanel clinicName={clinic.name} />
          )}

          <DatosBulkDownloadCards
            patients={exportPatients}
            records={exportRecords}
            patientsLimit={EXPORT_PATIENT_LIMIT}
            recordsLimit={EXPORT_RECORDS_LIMIT}
          />

          {!canImportPatients && !canImportClinical && (
            <p className="mt-6 text-sm text-amber-800">
              Tu rol no incluye permisos de importación. Pedí acceso a un administrador de la clínica.
            </p>
          )}

          <div className="mt-8">
            <Link href="/historias">
              <Button variant="outline">Ir a Historia clínica</Button>
            </Link>
          </div>
        </main>
      </div>
    </>
  );
}
