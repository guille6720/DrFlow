export type PatientEhrConsultation = {
  id: string;
  created_at: string;
  professional_id?: string | null;
  professional_name: string;
  professional_license_national?: string | null;
  professional_license_provincial?: string | null;
  professional_email?: string | null;
  professional_signature?: string | null;
  chief_complaint: string;
  diagnosis: string;
  evolution: string;
  indications: string;
  category: "evolution" | "diagnostic" | "treatment" | "vitals" | "document";
};

export type PatientEhrAttachment = {
  id: string;
  file_name: string;
  created_at: string;
  category: string | null;
};

export type PatientEhrPrescription = {
  id: string;
  created_at: string;
  label: string;
};

export type PatientEhrDiagnosisRow = {
  id: string;
  dateLabel: string;
  recordCreatedAt: string;
  name: string;
  chronic: boolean;
  recordId: string;
};

export type PatientEhrTreatmentRow = {
  id: string;
  dateLabel: string;
  recordCreatedAt: string;
  product: string;
  dose: string;
  frequency: string;
  notes: string;
  status: string;
  recordId: string;
};

import {
  type ClinicalDiagnosisEntry,
  type ClinicalTreatmentEntry,
  resolveDiagnosesForRecord,
  resolveTreatmentsForRecord,
} from "@/features/historias/utils/clinical-structured-entries";

import {
  extractMedicationDose,
  looksLikeClinicalFileName,
  looksLikeMedication,
  stripDiagnosisDecorators,
} from "@/lib/utils/ehr-clinical-category";
import { isHceStructuralChiefComplaint } from "@/lib/utils/hce-export-parse";
import { sanitizeClinicalDisplayText } from "@/lib/utils/sanitize-clinical-display";

function formatShortDate(iso: string): string {
  const d = new Date(iso);
  const day = d.getDate();
  const months = ["ENE", "FEB", "MAR", "ABR", "MAY", "JUN", "JUL", "AGO", "SEP", "OCT", "NOV", "DIC"];
  const yy = String(d.getFullYear()).slice(-2);
  return `${day}-${months[d.getMonth()]}-${yy}`;
}

function classifyCategory(
  chief_complaint: string,
  diagnosis = "",
  evolution = ""
): PatientEhrConsultation["category"] {
  const cc = chief_complaint.toLowerCase();
  if (cc.includes("signos vitales")) return "vitals";
  if (cc.includes("tratamiento")) return "treatment";
  if (cc.includes("diagnóstico") || cc.includes("diagnostico")) return "diagnostic";
  if (cc.includes("documento adjunto") || cc.includes("archivo")) return "document";
  if (
    looksLikeClinicalFileName(diagnosis) ||
    looksLikeClinicalFileName(evolution) ||
    looksLikeClinicalFileName(chief_complaint)
  ) {
    return "document";
  }
  return "evolution";
}

function stripHceMarker(text: string): string {
  return sanitizeClinicalDisplayText(text);
}

function diagnosisRowToTreatment(row: PatientEhrDiagnosisRow): PatientEhrTreatmentRow {
  const product = stripDiagnosisDecorators(row.name);
  return {
    id: `reclass-${row.id}`,
    dateLabel: row.dateLabel,
    recordCreatedAt: row.recordCreatedAt,
    product: product.slice(0, 120),
    dose: extractMedicationDose(product),
    frequency: "—",
    notes: row.name,
    status: "Actual",
    recordId: row.recordId,
  };
}

/** Reclasifica filas mal categorizadas en importaciones HCE (fármacos en diagnósticos). */
export function sanitizeEhrPayload(payload: {
  consultations: PatientEhrConsultation[];
  diagnosisRows: PatientEhrDiagnosisRow[];
  treatmentRows: PatientEhrTreatmentRow[];
}) {
  const diagnosisRows: PatientEhrDiagnosisRow[] = [];
  const treatmentRows = [...payload.treatmentRows];
  const treatKeys = new Set(treatmentRows.map((t) => t.product.toLowerCase().slice(0, 120)));

  for (const row of payload.diagnosisRows) {
    const core = stripDiagnosisDecorators(row.name);
    if (looksLikeClinicalFileName(core)) {
      continue;
    }
    if (looksLikeMedication(core)) {
      const key = core.toLowerCase().slice(0, 120);
      if (!treatKeys.has(key)) {
        treatKeys.add(key);
        treatmentRows.push(diagnosisRowToTreatment(row));
      }
      continue;
    }
    diagnosisRows.push(row);
  }

  return { ...payload, diagnosisRows, treatmentRows };
}

export function buildEhrPayloadFromRecords(
  records: Array<{
    id: string;
    created_at: string;
    chief_complaint: string | null;
    diagnosis: string | null;
    evolution: string | null;
    indications: string | null;
    diagnosis_cie10?: string | null;
    diagnoses_json?: unknown;
    treatments_json?: unknown;
    diagnoses_rows?: ClinicalDiagnosisEntry[] | null;
    treatments_rows?: ClinicalTreatmentEntry[] | null;
    professional_name: string;
    professional_license_national?: string | null;
    professional_license_provincial?: string | null;
    professional_email?: string | null;
    professional_id?: string | null;
    professional_signature?: string | null;
  }>,
  options?: { includeHceStructural?: boolean }
): {
  consultations: PatientEhrConsultation[];
  diagnosisRows: PatientEhrDiagnosisRow[];
  treatmentRows: PatientEhrTreatmentRow[];
} {
  const consultations: PatientEhrConsultation[] = [];
  const diagnosisRows: PatientEhrDiagnosisRow[] = [];
  const treatmentRows: PatientEhrTreatmentRow[] = [];
  const seenDiagnosis = new Set<string>();
  const includeHceStructural = options?.includeHceStructural === true;

  for (const r of records) {
    const chief = stripHceMarker(r.chief_complaint ?? "");
    const diagnosis = stripHceMarker(r.diagnosis ?? "");
    const evolution = sanitizeClinicalDisplayText(r.evolution ?? "");
    const category = classifyCategory(chief, diagnosis, evolution);
    const dateLabel = formatShortDate(r.created_at);
    const recordCreatedAt = r.created_at;
    const structuredDiagnoses = resolveDiagnosesForRecord(r);
    const structuredTreatments = resolveTreatmentsForRecord(r);

    const skipSidebar =
      !includeHceStructural && isHceStructuralChiefComplaint(r.chief_complaint);

    if (!skipSidebar) {
      consultations.push({
        id: r.id,
        created_at: r.created_at,
        professional_id: r.professional_id ?? null,
        professional_signature: r.professional_signature ?? null,
        professional_name: r.professional_name,
        professional_license_national: r.professional_license_national,
        professional_license_provincial: r.professional_license_provincial,
        professional_email: r.professional_email,
        chief_complaint: chief,
        diagnosis,
        evolution,
        // Phase 3: indications TEXT is a printable snapshot only.
        indications: sanitizeClinicalDisplayText(r.indications ?? ""),
        category,
      });
    }

    if (structuredDiagnoses.length > 0) {
      for (const [i, d] of structuredDiagnoses.entries()) {
        const name = d.cie10_code ? `${d.name} (CIE-10: ${d.cie10_code})` : d.name;
        const key = name.toLowerCase().slice(0, 120);
        if (seenDiagnosis.has(key)) continue;
        seenDiagnosis.add(key);
        diagnosisRows.push({
          id: `d-json-${r.id}-${i}`,
          dateLabel,
          recordCreatedAt,
          name,
          chronic: Boolean(d.is_chronic),
          recordId: r.id,
        });
      }
    } else if (
      diagnosis &&
      category !== "vitals" &&
      category !== "document" &&
      !looksLikeClinicalFileName(diagnosis)
    ) {
      // Legacy TEXT snapshot fallback for diagnosis list (no line parser).
      const key = diagnosis.toLowerCase().slice(0, 120);
      if (!seenDiagnosis.has(key)) {
        seenDiagnosis.add(key);
        diagnosisRows.push({
          id: `d-${r.id}`,
          dateLabel,
          recordCreatedAt,
          name: diagnosis,
          chronic: category === "diagnostic" || chief.toLowerCase().includes("crónic"),
          recordId: r.id,
        });
      }
    }

    // Phase 3: treatment table comes only from structured rows/JSON — never parse indications.
    if (structuredTreatments.length > 0) {
      for (const [i, t] of structuredTreatments.entries()) {
        treatmentRows.push({
          id: `t-json-${r.id}-${i}`,
          dateLabel,
          recordCreatedAt,
          product: t.product.slice(0, 120),
          dose: t.dose?.slice(0, 40) ?? "—",
          frequency: t.frequency?.slice(0, 40) ?? "—",
          notes: t.notes ?? t.product,
          status: t.status ?? "Actual",
          recordId: r.id,
        });
      }
    }
  }

  return sanitizeEhrPayload({ consultations, diagnosisRows, treatmentRows });
}
