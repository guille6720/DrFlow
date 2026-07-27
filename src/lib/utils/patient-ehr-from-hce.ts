import type { HceExportRow } from "@/lib/utils/hce-export-parse";
import { parsePatientHceSummaryCsv } from "@/lib/utils/hce-export-parse";
import type { createClient } from "@/lib/supabase/server";
import type {
  PatientEhrConsultation,
  PatientEhrDiagnosisRow,
  PatientEhrTreatmentRow,
} from "@/lib/utils/patient-ehr-model";

function formatShortDateFromIso(iso: string | null, fallbackIso: string): string {
  const raw = iso ?? fallbackIso;
  const d = new Date(raw.includes("T") ? raw : `${raw}T12:00:00.000Z`);
  if (Number.isNaN(d.getTime())) return "—";
  const months = ["ENE", "FEB", "MAR", "ABR", "MAY", "JUN", "JUL", "AGO", "SEP", "OCT", "NOV", "DIC"];
  return `${d.getDate()}-${months[d.getMonth()]}-${String(d.getFullYear()).slice(-2)}`;
}

function parseTreatmentFromHceRow(row: HceExportRow, recordId: string): PatientEhrTreatmentRow {
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

    if (tipo === "diagnostics" && row.diagnostico.trim()) {
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
        name,
        chronic: /chronic|cr[oó]nic/i.test(row.estado),
        recordId,
      });
      continue;
    }

    if (tipo === "treatments") {
      treatmentRows.push(parseTreatmentFromHceRow(row, recordId));
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

  return { consultations, diagnosisRows, treatmentRows };
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
  return { consultations, diagnosisRows, treatmentRows };
}

export const HCE_SUMMARY_ATTACHMENT_NAME = "hce-export-resumen.csv";
const HCE_STORAGE_BUCKET = "clinical-files";

export async function loadPatientHceSummaryRows(
  supabase: Awaited<ReturnType<typeof createClient>>,
  clinicId: string,
  patientId: string
): Promise<HceExportRow[] | null> {
  const { data: att } = await supabase
    .from("patient_attachments")
    .select("file_path")
    .eq("patient_id", patientId)
    .eq("clinic_id", clinicId)
    .eq("file_name", HCE_SUMMARY_ATTACHMENT_NAME)
    .maybeSingle();

  if (!att?.file_path) return null;

  const { data: blob, error } = await supabase.storage
    .from(HCE_STORAGE_BUCKET)
    .download(att.file_path);

  if (error || !blob) return null;

  const text = await blob.text();
  const rows = parsePatientHceSummaryCsv(text);
  return rows.length > 0 ? rows : null;
}
