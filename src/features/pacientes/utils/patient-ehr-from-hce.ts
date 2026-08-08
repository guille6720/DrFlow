import type { createClient } from "@/core/supabase/server";

import type {
  PatientEhrConsultation,
  PatientEhrDiagnosisRow,
  PatientEhrTreatmentRow,
} from "@/features/pacientes/utils/patient-ehr-model";
import { sanitizeEhrPayload } from "@/features/pacientes/utils/patient-ehr-model";

import { looksLikeClinicalFileName, looksLikeMedication } from "@/lib/utils/ehr-clinical-category";
import type { HceExportRow } from "@/lib/utils/hce-export-parse";
import { parsePatientHceSummaryCsv } from "@/lib/utils/hce-export-parse";

function formatShortDateFromIso(iso: string | null, fallbackIso: string): string {
  const raw = iso ?? fallbackIso;
  const d = new Date(raw.includes("T") ? raw : `${raw}T12:00:00.000Z`);
  if (Number.isNaN(d.getTime())) return "—";
  const months = ["ENE", "FEB", "MAR", "ABR", "MAY", "JUN", "JUL", "AGO", "SEP", "OCT", "NOV", "DIC"];
  return `${d.getDate()}-${months[d.getMonth()]}-${String(d.getFullYear()).slice(-2)}`;
}

function parseTreatmentFromHceRow(row: HceExportRow, recordId: string, recordCreatedAt: string): PatientEhrTreatmentRow {
  const product = row.diagnostico.trim() || row.notas.trim() || "Tratamiento";
  const notes = row.notas.trim();
  const doseMatch =
    notes.match(/(\d+(?:[.,]\d+)?\s*(?:mg|mcg|g|ml|ui|%)?)/i) ||
    product.match(/(\d+(?:[.,]\d+)?\s*(?:mg|mcg|g|ml|ui|%)?)/i);
  const dose = doseMatch?.[1] ?? "—";
  const statusLabel = row.estado?.trim() || "n/a";
  const dateLabel = formatShortDateFromIso(row.fecha_inicio, row.fecha_inicio ?? "1970-01-01");
  const statusDate = row.fecha_inicio
    ? formatShortDateFromIso(row.fecha_inicio, row.fecha_inicio)
    : dateLabel;

  return {
    id: recordId,
    dateLabel,
    recordCreatedAt,
    product,
    dose,
    frequency: "—",
    notes: notes || "—",
    status: `Actual ${statusDate} (${statusLabel})`,
    recordId,
  };
}

/** Construye tablas como el export HCE original (diagnósticos / tratamientos / evoluciones). */
export function buildEhrPayloadFromHceRows(
  rows: HceExportRow[],
  professionalFallback: string
): {
  consultations: PatientEhrConsultation[];
  diagnosisRows: PatientEhrDiagnosisRow[];
  treatmentRows: PatientEhrTreatmentRow[];
} {
  const consultations: PatientEhrConsultation[] = [];
  const diagnosisRows: PatientEhrDiagnosisRow[] = [];
  const treatmentRows: PatientEhrTreatmentRow[] = [];

  for (const row of rows) {
    const tipo = row.tipo_registro.toLowerCase();
    const recordId = `hce-${row.lineNumber}`;
    const iso = row.fecha_inicio ? `${row.fecha_inicio}T12:00:00.000Z` : new Date().toISOString();
    const dateLabel = formatShortDateFromIso(row.fecha_inicio, iso);

    if (tipo === "files" && row.diagnostico.trim()) {
      consultations.push({
        id: recordId,
        created_at: iso,
        professional_name: professionalFallback,
        chief_complaint: "Documento adjunto importado",
        diagnosis: row.diagnostico.trim(),
        evolution: row.notas.trim() || "",
        indications: "",
        category: "document",
      });
      continue;
    }

    if (tipo === "diagnostics" && row.diagnostico.trim()) {
      if (looksLikeClinicalFileName(row.diagnostico.trim())) {
        consultations.push({
          id: recordId,
          created_at: iso,
          professional_name: professionalFallback,
          chief_complaint: "Documento adjunto importado",
          diagnosis: row.diagnostico.trim(),
          evolution: row.notas.trim() || "",
          indications: "",
          category: "document",
        });
        continue;
      }

      if (looksLikeMedication(row.diagnostico.trim())) {
        treatmentRows.push(parseTreatmentFromHceRow(row, recordId, iso));
        continue;
      }

      const chronic = /chronic|cr[oó]nic/i.test(row.estado);
      const name = [
        chronic ? "Crónico" : "",
        row.diagnostico.trim(),
        row.cie10 ? `CIE-10: ${row.cie10}` : "",
      ]
        .filter(Boolean)
        .join(" ");
      diagnosisRows.push({
        id: recordId,
        dateLabel,
        recordCreatedAt: iso,
        name,
        chronic: /chronic|cr[oó]nic/i.test(row.estado),
        recordId,
      });
      continue;
    }

    if (tipo === "treatments") {
      treatmentRows.push(parseTreatmentFromHceRow(row, recordId, iso));
      continue;
    }

    if (tipo === "records" && (row.notas.trim() || row.diagnostico.trim())) {
      consultations.push({
        id: recordId,
        created_at: iso,
        professional_name: professionalFallback,
        chief_complaint: row.diagnostico.trim() || "Evolución",
        diagnosis: "",
        evolution: row.notas.trim() || row.diagnostico.trim(),
        indications: "",
        category: "evolution",
      });
      continue;
    }

    if (tipo === "vitalsigns") {
      consultations.push({
        id: recordId,
        created_at: iso,
        professional_name: professionalFallback,
        chief_complaint: "Signos vitales",
        diagnosis: "",
        evolution: row.notas.trim() || row.diagnostico.trim(),
        indications: "",
        category: "vitals",
      });
    }
  }

  return sanitizeEhrPayload({ consultations, diagnosisRows, treatmentRows });
}

export function mergeEhrPayload(
  primary: {
    consultations: PatientEhrConsultation[];
    diagnosisRows: PatientEhrDiagnosisRow[];
    treatmentRows: PatientEhrTreatmentRow[];
  },
  supplemental: {
    consultations: PatientEhrConsultation[];
    diagnosisRows: PatientEhrDiagnosisRow[];
    treatmentRows: PatientEhrTreatmentRow[];
  }
) {
  const evoIds = new Set(primary.consultations.map((c) => c.id));
  const consultations = [
    ...primary.consultations,
    ...supplemental.consultations.filter((c) => !evoIds.has(c.id) && c.category === "evolution"),
  ];
  const diagKeys = new Set(primary.diagnosisRows.map((d) => d.name.toLowerCase()));
  const diagnosisRows = [
    ...primary.diagnosisRows,
    ...supplemental.diagnosisRows.filter((d) => !diagKeys.has(d.name.toLowerCase())),
  ];
  const treatKeys = new Set(primary.treatmentRows.map((t) => t.product.toLowerCase()));
  const treatmentRows = [
    ...primary.treatmentRows,
    ...supplemental.treatmentRows.filter((t) => !treatKeys.has(t.product.toLowerCase())),
  ];
  return sanitizeEhrPayload({ consultations, diagnosisRows, treatmentRows });
}

export const HCE_SUMMARY_ATTACHMENT_NAME = "hce-export-resumen.csv";
const HCE_STORAGE_BUCKET = "clinical-files";

export async function loadPatientHceSummaryRows(
  supabase: Awaited<ReturnType<typeof createClient>>,
  clinicId: string,
  patientId: string,
  preloadedFilePath?: string | null
): Promise<HceExportRow[] | null> {
  let filePath = preloadedFilePath;

  if (filePath === undefined) {
    const { data: att } = await supabase
      .from("patient_attachments")
      .select("file_path")
      .eq("patient_id", patientId)
      .eq("clinic_id", clinicId)
      .eq("file_name", HCE_SUMMARY_ATTACHMENT_NAME)
      .maybeSingle();
    filePath = att?.file_path ?? null;
  }

  if (!filePath) return null;

  const { data: blob, error } = await supabase.storage
    .from(HCE_STORAGE_BUCKET)
    .download(filePath);

  if (error || !blob) return null;

  const text = await blob.text();
  const rows = parsePatientHceSummaryCsv(text);
  return rows.length > 0 ? rows : null;
}
