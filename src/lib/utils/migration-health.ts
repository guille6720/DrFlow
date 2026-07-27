import { isHceStructuralChiefComplaint } from "@/lib/utils/hce-export-parse";
import { HCE_SUMMARY_ATTACHMENT_NAME } from "@/lib/utils/patient-ehr-from-hce";

export type MigrationPatientRow = {
  id: string;
  first_name: string;
  last_name: string;
  document_number: string;
  notes: string | null;
};

export type MigrationAttachmentRow = {
  patient_id: string;
  file_name: string;
  file_type: string | null;
  category: string | null;
};

export type MigrationRecordRow = {
  patient_id: string;
  chief_complaint: string | null;
  evolution: string | null;
};

export type MigrationHealthPatientGap = {
  id: string;
  last_name: string;
  first_name: string;
  document_number: string;
};

export type MigrationDuplicateDniGroup = {
  document_number: string;
  patients: MigrationHealthPatientGap[];
};

export type MigrationStepStatus = "done" | "partial" | "pending";

export type MigrationHealthReport = {
  totals: {
    activePatients: number;
    withConsumerRef: number;
    withHceSummary: number;
    withClinicalPdf: number;
    withEvolutionConsultation: number;
    withHceClinicalRecords: number;
    placeholderDniWithoutConsumer: number;
    duplicateDniGroups: number;
  };
  steps: Array<{
    id: "consumers" | "hce" | "pdf";
    title: string;
    status: MigrationStepStatus;
    description: string;
    anchor: string;
  }>;
  pendingPdf: MigrationHealthPatientGap[];
  missingHceSummary: MigrationHealthPatientGap[];
  duplicateDnis: MigrationDuplicateDniGroup[];
  recordsTruncated: boolean;
  pendingPdfTotal: number;
  missingHceSummaryTotal: number;
};

const REPORT_LIST_LIMIT = 40;

export function isPlaceholderImportDni(document_number: string): boolean {
  const digits = document_number.replace(/\D/g, "");
  return digits.length === 8 && digits.startsWith("90");
}

export function hasConsumerImportRef(notes: string | null): boolean {
  if (!notes) return false;
  return /consumers\//i.test(notes) || /ID importación:/i.test(notes);
}

function recordCountsAsEvolution(row: MigrationRecordRow): boolean {
  const chief = row.chief_complaint ?? "";
  if (/^\[Import:/i.test(chief)) return true;
  if (isHceStructuralChiefComplaint(chief)) return false;
  const evo = (row.evolution ?? "").trim();
  if (evo.length >= 25) return true;
  if (/^\[HCE:/i.test(chief)) return false;
  return evo.length > 0 && !/Tratamiento importado|Diagnóstico importado/i.test(chief);
}

function hasHceClinicalMarker(row: MigrationRecordRow): boolean {
  return /^\[HCE:/i.test(row.chief_complaint ?? "");
}

function toGap(p: MigrationPatientRow): MigrationHealthPatientGap {
  return {
    id: p.id,
    last_name: p.last_name,
    first_name: p.first_name,
    document_number: p.document_number,
  };
}

function stepStatus(ratio: number, anyActivity: boolean): MigrationStepStatus {
  if (ratio >= 0.85) return "done";
  if (anyActivity) return "partial";
  return "pending";
}

export function buildMigrationHealthReport(input: {
  patients: MigrationPatientRow[];
  attachments: MigrationAttachmentRow[];
  records: MigrationRecordRow[];
  recordsTruncated?: boolean;
}): MigrationHealthReport {
  const { patients, attachments, records, recordsTruncated = false } = input;

  const attachmentByPatient = new Map<string, MigrationAttachmentRow[]>();
  for (const att of attachments) {
    const list = attachmentByPatient.get(att.patient_id) ?? [];
    list.push(att);
    attachmentByPatient.set(att.patient_id, list);
  }

  const evolutionPatients = new Set<string>();
  const hceRecordPatients = new Set<string>();
  for (const rec of records) {
    if (hasHceClinicalMarker(rec)) hceRecordPatients.add(rec.patient_id);
    if (recordCountsAsEvolution(rec)) evolutionPatients.add(rec.patient_id);
  }

  let withConsumerRef = 0;
  let withHceSummary = 0;
  let withClinicalPdf = 0;
  let withEvolutionConsultation = 0;
  let withHceClinicalRecords = 0;
  let placeholderDniWithoutConsumer = 0;

  const pendingPdfAll: MigrationHealthPatientGap[] = [];
  const missingHceSummaryAll: MigrationHealthPatientGap[] = [];

  for (const p of patients) {
    const notes = p.notes;
    const consumer = hasConsumerImportRef(notes);
    if (consumer) withConsumerRef += 1;
    if (!consumer && isPlaceholderImportDni(p.document_number)) placeholderDniWithoutConsumer += 1;

    const atts = attachmentByPatient.get(p.id) ?? [];
    const hasSummary = atts.some((a) => a.file_name === HCE_SUMMARY_ATTACHMENT_NAME);
    const hasPdf = atts.some(
      (a) =>
        a.file_name !== HCE_SUMMARY_ATTACHMENT_NAME &&
        (a.file_type === "application/pdf" || /\.pdf$/i.test(a.file_name)) &&
        (a.category === "historia_clinica" || a.category == null)
    );

    if (hasSummary) withHceSummary += 1;
    if (hasPdf) withClinicalPdf += 1;

    const hasHceRec = hceRecordPatients.has(p.id);
    if (hasHceRec) withHceClinicalRecords += 1;

    const hasEvo = evolutionPatients.has(p.id);
    if (hasEvo) withEvolutionConsultation += 1;

    if (hasHceRec && !hasSummary) missingHceSummaryAll.push(toGap(p));

    const needsPdf = (hasSummary || hasHceRec) && !hasPdf && !hasEvo;
    if (needsPdf) pendingPdfAll.push(toGap(p));
  }

  const dniGroups = new Map<string, MigrationPatientRow[]>();
  for (const p of patients) {
    const key = p.document_number.replace(/\D/g, "") || p.id;
    const group = dniGroups.get(key) ?? [];
    group.push(p);
    dniGroups.set(key, group);
  }

  const duplicateDnis: MigrationDuplicateDniGroup[] = [];
  for (const [document_number, group] of dniGroups) {
    if (group.length < 2) continue;
    duplicateDnis.push({
      document_number,
      patients: group.map(toGap),
    });
  }
  duplicateDnis.sort((a, b) => b.patients.length - a.patients.length);

  const total = patients.length;
  const consumerRatio = total > 0 ? withConsumerRef / total : 0;
  const hceRatio =
    withHceClinicalRecords > 0
      ? withHceSummary / withHceClinicalRecords
      : withHceSummary > 0
        ? 1
        : 0;
  const pdfRatio =
    withHceSummary + withHceClinicalRecords > 0
      ? 1 - pendingPdfAll.length / Math.max(1, withHceSummary || withHceClinicalRecords)
      : withEvolutionConsultation > 0
        ? 1
        : 0;

  const steps: MigrationHealthReport["steps"] = [
    {
      id: "consumers",
      title: "1. Pacientes (Excel consumers)",
      status: stepStatus(consumerRatio, withConsumerRef > 0),
      description:
        consumerRatio >= 0.85
          ? `${withConsumerRef} de ${total} fichas con ID de importación (DNI confiable).`
          : withConsumerRef > 0
            ? `${withConsumerRef}/${total} con ID consumers — importá el Excel antes del HCE para evitar DNI placeholder.`
            : "Sin rastro de import consumers. Subí el Excel de pacientes primero.",
      anchor: "#import-consumers",
    },
    {
      id: "hce",
      title: "2. Export HCE (HCE_export.csv)",
      status:
        missingHceSummaryAll.length === 0 && withHceSummary > 0
          ? "done"
          : withHceSummary > 0 || withHceClinicalRecords > 0
            ? "partial"
            : "pending",
      description:
        withHceSummary > 0
          ? `${withHceSummary} pacientes con resumen HCE adjunto.` +
            (missingHceSummaryAll.length > 0
              ? ` ${missingHceSummaryAll.length} tienen registros HCE pero les falta el CSV resumen — reimportá HCE_export.csv.`
              : "")
          : withHceClinicalRecords > 0
            ? `${withHceClinicalRecords} con registros HCE sin resumen CSV — reimportá HCE_export.csv.`
            : "Aún no hay datos HCE. Subí HCE_export.csv después de consumers.",
      anchor: "#import-historias",
    },
    {
      id: "pdf",
      title: "3. Historias PDF (evoluciones)",
      status:
        pendingPdfAll.length === 0 && withEvolutionConsultation > 0
          ? "done"
          : withClinicalPdf > 0 || withEvolutionConsultation > 0
            ? "partial"
            : total > 0 && (withHceSummary > 0 || withHceClinicalRecords > 0)
              ? "partial"
              : "pending",
      description:
        pendingPdfAll.length === 0
          ? `Evoluciones detectadas en ${withEvolutionConsultation} paciente(s); ${withClinicalPdf} con PDF archivado.`
          : `${pendingPdfAll.length} paciente(s) con HCE pero sin evolución ni PDF — importá su historia PDF.`,
      anchor: "#import-historias",
    },
  ];

  if (hceRatio < 0.9 && steps[1].status === "done") steps[1].status = "partial";
  if (pdfRatio < 0.85 && pendingPdfAll.length > 5) steps[2].status = "partial";

  return {
    totals: {
      activePatients: total,
      withConsumerRef,
      withHceSummary,
      withClinicalPdf,
      withEvolutionConsultation,
      withHceClinicalRecords,
      placeholderDniWithoutConsumer,
      duplicateDniGroups: duplicateDnis.length,
    },
    steps,
    pendingPdf: pendingPdfAll.slice(0, REPORT_LIST_LIMIT),
    missingHceSummary: missingHceSummaryAll.slice(0, REPORT_LIST_LIMIT),
    duplicateDnis: duplicateDnis.slice(0, 15),
    recordsTruncated,
    pendingPdfTotal: pendingPdfAll.length,
    missingHceSummaryTotal: missingHceSummaryAll.length,
  };
}
