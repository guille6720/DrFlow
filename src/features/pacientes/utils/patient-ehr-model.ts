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
  extractMedicationDose,
  looksLikeClinicalFileName,
  looksLikeMedication,
  stripDiagnosisDecorators,
} from "@/lib/utils/ehr-clinical-category";
import { isHceStructuralChiefComplaint } from "@/lib/utils/hce-export-parse";
import { sanitizeClinicalDisplayText } from "@/lib/utils/sanitize-clinical-display";
import {
  resolveDiagnosesForRecord,
  resolveTreatmentsForRecord,
  type ClinicalDiagnosisEntry,
  type ClinicalTreatmentEntry,
} from "@/features/historias/utils/clinical-structured-entries";

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

function parseTreatmentLines(
  indications: string,
  recordId: string,
  dateLabel: string,
  recordCreatedAt: string
): PatientEhrTreatmentRow[] {
  const raw = indications.trim();
  if (!raw) return [];

  const lines = raw.split(/\n+/).map((l) => l.trim()).filter(Boolean);
  if (lines.length === 0) return [];

  return lines
    .filter((line) => !/^estado\s*:/i.test(line))
    .map((line, i) => {
    const parts = line.split(/\s*[·|–-]\s*/);
    const product = parts[0]?.slice(0, 80) || line.slice(0, 80);
    return {
      id: `${recordId}-t-${i}`,
      dateLabel,
      recordCreatedAt,
      product,
      dose: parts[1]?.slice(0, 40) ?? "—",
      frequency: parts[2]?.slice(0, 40) ?? "—",
      notes: line,
      status: "Actual",
      recordId,
    };
  });
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

/** Reclasifica filas mal categorizadas (p. ej. fármacos en diagnósticos). */
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
  }>
): {
  consultations: PatientEhrConsultation[];
  diagnosisRows: PatientEhrDiagnosisRow[];
  treatmentRows: PatientEhrTreatmentRow[];
} {
  const consultations: PatientEhrConsultation[] = [];
  const diagnosisRows: PatientEhrDiagnosisRow[] = [];
  const treatmentRows: PatientEhrTreatmentRow[] = [];
  const seenDiagnosis = new Set<string>();

  for (const r of records) {
    const chief = stripHceMarker(r.chief_complaint ?? "");
    const diagnosis = stripHceMarker(r.diagnosis ?? "");
    const evolution = sanitizeClinicalDisplayText(r.evolution ?? "");
    const category = classifyCategory(chief, diagnosis, evolution);
    const dateLabel = formatShortDate(r.created_at);
    const recordCreatedAt = r.created_at;
    const structuredDiagnoses = resolveDiagnosesForRecord(r);
    const structuredTreatments = resolveTreatmentsForRecord(r);

    const skipSidebar = isHceStructuralChiefComplaint(r.chief_complaint);

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
    } else {
      const diagText = diagnosis;
      if (
        diagText &&
        category !== "vitals" &&
        category !== "document" &&
        !looksLikeClinicalFileName(diagText)
      ) {
        const key = diagText.toLowerCase().slice(0, 120);

        if (looksLikeMedication(diagText) || category === "treatment") {
          if (!treatmentRows.some((t) => t.product.toLowerCase().slice(0, 120) === key)) {
            treatmentRows.push({
              id: `t-${r.id}-diag`,
              dateLabel,
              recordCreatedAt,
              product: diagText.slice(0, 120),
              dose: extractMedicationDose(diagText),
              frequency: "—",
              notes: (r.indications ?? r.evolution ?? "").trim() || diagText,
              status: "Actual",
              recordId: r.id,
            });
          }
        } else if (!seenDiagnosis.has(key)) {
          seenDiagnosis.add(key);
          diagnosisRows.push({
            id: `d-${r.id}`,
            dateLabel,
            recordCreatedAt,
            name: diagText,
            chronic: category === "diagnostic" || chief.toLowerCase().includes("crónic"),
            recordId: r.id,
          });
        }
      }
    }

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
    } else if (r.indications?.trim()) {
      const parsed = parseTreatmentLines(r.indications, r.id, dateLabel, recordCreatedAt);
      if (parsed.length > 0) {
        treatmentRows.push(...parsed);
      }
    }

    if (
      category === "treatment" &&
      diagnosis &&
      structuredTreatments.length === 0 &&
      !treatmentRows.some((t) => t.recordId === r.id)
    ) {
      treatmentRows.push({
        id: `t-${r.id}`,
        dateLabel,
        recordCreatedAt,
        product: diagnosis.slice(0, 80),
        dose: (r.indications ?? "").trim() || "—",
        frequency: "—",
        notes: (r.evolution ?? "").trim() || "—",
        status: "Actual",
        recordId: r.id,
      });
    }
  }

  return sanitizeEhrPayload({ consultations, diagnosisRows, treatmentRows });
}
