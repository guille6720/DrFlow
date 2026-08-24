"use server";

import { resolveImportAccess } from "@/core/actions/action-response";
import { buildExportAuditMetadata } from "@/core/compliance/data-export-security";
import { requireAddonFeatureAccess } from "@/core/entitlements/entitlements.server";
import { FEATURES } from "@/core/entitlements/features";
import { recordAudit } from "@/core/security/audit-service";
import {
  requireBulkExportAccess,
  requirePatientExportAccess,
} from "@/core/services/import-access.service";
import { createClient } from "@/core/supabase/server";

import {
  sanitizeExportFileName,
  toCsvDocument,
} from "@/features/integraciones/lib/spreadsheet-export-safety";

const EXPORT_PAGE = 500;
const EXPORT_MAX = 5000;

const PATIENT_EXPORT_HEADERS = [
  "apellido",
  "nombre",
  "dni",
  "fecha_nacimiento",
  "telefono",
  "email",
  "direccion",
  "obra_social",
  "plan",
  "nro_afiliado",
];

type PatientExportRecord = {
  last_name: string;
  first_name: string;
  document_number: string;
  birth_date: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  insurance_provider: string | null;
  insurance_plan: string | null;
  insurance_number: string | null;
};

async function loadExportPatients(
  clinicId: string
): Promise<PatientExportRecord[]> {
  const supabase = await createClient();
  const rows: PatientExportRecord[] = [];
  let from = 0;

  while (rows.length < EXPORT_MAX) {
    const to = Math.min(from + EXPORT_PAGE - 1, EXPORT_MAX - 1);
    const { data, error } = await supabase
      .from("patients")
      .select(
        "last_name, first_name, document_number, birth_date, phone, email, address, insurance_provider, insurance_plan, insurance_number"
      )
      .eq("clinic_id", clinicId)
      .eq("is_active", true)
      .order("last_name")
      .range(from, to);

    if (error) throw new Error("No se pudieron leer los pacientes.");
    if (!data || data.length === 0) break;
    rows.push(...(data as PatientExportRecord[]));
    if (data.length < EXPORT_PAGE) break;
    from += EXPORT_PAGE;
  }

  return rows;
}

function toRows(patients: PatientExportRecord[]): string[][] {
  return [
    PATIENT_EXPORT_HEADERS,
    ...patients.map((patient) => [
      patient.last_name,
      patient.first_name,
      patient.document_number,
      patient.birth_date ?? "",
      patient.phone ?? "",
      patient.email ?? "",
      patient.address ?? "",
      patient.insurance_provider ?? "",
      patient.insurance_plan ?? "",
      patient.insurance_number ?? "",
    ]),
  ];
}

export async function exportClinicPatientsSpreadsheet(
  format: "csv" | "xlsx",
  options?: { bulk?: boolean }
): Promise<{ error?: string; fileName?: string; mime?: string; base64?: string }> {
  const access = options?.bulk
    ? await requireBulkExportAccess()
    : await requirePatientExportAccess();
  const auth = resolveImportAccess(access);
  if (!auth.ok) return { error: auth.error };

  const entitlement = await requireAddonFeatureAccess(FEATURES.DATA_EXPORT);
  if (!entitlement.ok) return { error: entitlement.error };

  const patients = await loadExportPatients(auth.clinicId);
  const fileBase = sanitizeExportFileName(`pacientes-drflow-${auth.clinicId.slice(0, 8)}`);

  await recordAudit({
    clinicId: auth.clinicId,
    module: "imports",
    entityType: "data_export",
    entityId: auth.clinicId,
    action: "export",
    what: "Exportó padrón de pacientes",
    metadata: buildExportAuditMetadata({
      channel: "patient_roster_csv_xlsx",
      format,
      recordCount: patients.length,
      extra: {
        bulk: Boolean(options?.bulk),
        sections: ["demographics"],
      },
    }),
  });

  if (format === "csv") {
    return {
      fileName: `${fileBase}.csv`,
      mime: "text/csv;charset=utf-8",
      base64: Buffer.from(toCsvDocument(toRows(patients)), "utf8").toString("base64"),
    };
  }

  const XLSX = await import("xlsx");
  const sheet = XLSX.utils.aoa_to_sheet(toRows(patients));
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, "Pacientes");
  const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer;

  return {
    fileName: `${fileBase}.xlsx`,
    mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    base64: buffer.toString("base64"),
  };
}

export async function countClinicPatientsForExport(): Promise<{
  error?: string;
  count?: number;
}> {
  const access = await requirePatientExportAccess();
  const auth = resolveImportAccess(access);
  if (!auth.ok) return { error: auth.error };

  const entitlement = await requireAddonFeatureAccess(FEATURES.DATA_EXPORT);
  if (!entitlement.ok) return { error: entitlement.error };

  const supabase = await createClient();
  const { count, error } = await supabase
    .from("patients")
    .select("id", { count: "exact", head: true })
    .eq("clinic_id", auth.clinicId)
    .eq("is_active", true);
  if (error) return { error: "No se pudo estimar el padrón." };
  return { count: count ?? 0 };
}
