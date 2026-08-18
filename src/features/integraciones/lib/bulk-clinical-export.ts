import {
  buildClinicalExportDocument,
  type ClinicalExportSnapshot,
  countExportedRecords,
} from "@/features/integraciones/lib/clinical-export-package";
import {
  ALL_CLINICAL_EXPORT_SECTIONS,
  type ClinicalExportDateRange,
  type ClinicalExportSection,
  parseClinicalExportSections,
  parseExportDateRange,
} from "@/features/integraciones/lib/clinical-export-sections";
import { neutralizeSpreadsheetCell } from "@/features/integraciones/lib/spreadsheet-export-safety";

import {
  BULK_EXPORT_MAX_CSV_CLINICAL,
  BULK_EXPORT_MAX_CSV_DEMOGRAPHICS,
  BULK_EXPORT_MAX_FHIR_PATIENTS,
  BULK_EXPORT_MAX_JSON_PATIENTS,
  BULK_EXPORT_MAX_SELECTED_PATIENTS,
  BULK_EXPORT_MAX_ZIP_PATIENTS,
} from "@/lib/constants/clinical-documents";

export type BulkClinicalExportFormat = "csv" | "xlsx" | "json" | "fhir" | "zip";

export type BulkClinicalExportRequest = {
  format: BulkClinicalExportFormat;
  scope: "all" | "selected";
  patientIds: string[];
  sections: ClinicalExportSection[];
  range: ClinicalExportDateRange;
  professionalId: string | null;
  insuranceProvider: string | null;
  confirmed: true;
};

const FORMAT_SET = new Set<BulkClinicalExportFormat>(["csv", "xlsx", "json", "fhir", "zip"]);

export function isDemographicsOnly(sections: ClinicalExportSection[]): boolean {
  return sections.length === 1 && sections[0] === "demographics";
}

export function bulkExportPatientCap(
  format: BulkClinicalExportFormat,
  sections: ClinicalExportSection[]
): number {
  if (format === "zip") return BULK_EXPORT_MAX_ZIP_PATIENTS;
  if (format === "fhir") return BULK_EXPORT_MAX_FHIR_PATIENTS;
  if (format === "json") return BULK_EXPORT_MAX_JSON_PATIENTS;
  if (format === "csv" || format === "xlsx") {
    return isDemographicsOnly(sections)
      ? BULK_EXPORT_MAX_CSV_DEMOGRAPHICS
      : BULK_EXPORT_MAX_CSV_CLINICAL;
  }
  return BULK_EXPORT_MAX_CSV_CLINICAL;
}

export function parseBulkClinicalExportFilters(
  raw: unknown
): { ok: true; request: Omit<BulkClinicalExportRequest, "confirmed"> } | { ok: false; error: string } {
  if (!raw || typeof raw !== "object") return { ok: false, error: "Pedido de exportación inválido." };
  const input = raw as Record<string, unknown>;
  const format = input.format;
  if (typeof format !== "string" || !FORMAT_SET.has(format as BulkClinicalExportFormat)) {
    return { ok: false, error: "Formato de exportación inválido." };
  }
  const scope = input.scope === "selected" ? "selected" : "all";
  const patientIds = Array.isArray(input.patientIds)
    ? input.patientIds.filter((id): id is string => typeof id === "string")
    : [];
  if (scope === "selected" && patientIds.length === 0) {
    return { ok: false, error: "Seleccioná al menos un paciente." };
  }
  if (patientIds.length > BULK_EXPORT_MAX_SELECTED_PATIENTS) {
    return { ok: false, error: `Máximo ${BULK_EXPORT_MAX_SELECTED_PATIENTS} pacientes seleccionados.` };
  }
  const rangeParsed = parseExportDateRange(input.dateFrom, input.dateTo);
  if (!rangeParsed.ok) return { ok: false, error: rangeParsed.error };
  const professionalId =
    typeof input.professionalId === "string" && input.professionalId.trim()
      ? input.professionalId.trim()
      : null;
  const insuranceProvider =
    typeof input.insuranceProvider === "string" && input.insuranceProvider.trim()
      ? input.insuranceProvider.trim().slice(0, 80)
      : null;
  const sections = parseClinicalExportSections(input.sections);
  return {
    ok: true,
    request: {
      format: format as BulkClinicalExportFormat,
      scope,
      patientIds,
      sections: sections.length ? sections : [...ALL_CLINICAL_EXPORT_SECTIONS],
      range: rangeParsed.range,
      professionalId,
      insuranceProvider,
    },
  };
}

export function parseBulkClinicalExportRequest(
  raw: unknown
): { ok: true; request: BulkClinicalExportRequest } | { ok: false; error: string } {
  const parsed = parseBulkClinicalExportFilters(raw);
  if (!parsed.ok) return parsed;
  if (!raw || typeof raw !== "object" || (raw as { confirmed?: unknown }).confirmed !== true) {
    return { ok: false, error: "Confirmá que vas a descargar datos sensibles." };
  }
  return { ok: true, request: { ...parsed.request, confirmed: true } };
}

export function flattenBulkExportSheets(
  snapshots: ClinicalExportSnapshot[],
  sections: ClinicalExportSection[]
): Record<string, string[][]> {
  const include = new Set(sections);
  const sheets: Record<string, string[][]> = {};

  if (include.has("demographics")) {
    sheets.pacientes = [
      [
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
      ],
      ...snapshots.map((item) => [
        item.patient.last_name,
        item.patient.first_name,
        item.patient.document_number,
        item.patient.birth_date ?? "",
        item.patient.phone ?? "",
        item.patient.email ?? "",
        item.patient.address ?? "",
        item.patient.insurance_provider ?? "",
        item.patient.insurance_plan ?? "",
        item.patient.insurance_number ?? "",
      ]),
    ];
  }

  if (include.has("consultations")) {
    sheets.consultas = [
      ["dni", "fecha", "profesional", "motivo", "diagnostico", "evolucion", "indicaciones"],
      ...snapshots.flatMap((item) =>
        item.consultations.map((row) => [
          item.patient.document_number,
          row.date,
          row.professional_name,
          row.chief_complaint,
          row.diagnosis,
          row.evolution,
          row.indications,
        ])
      ),
    ];
  }

  if (include.has("diagnoses")) {
    sheets.diagnosticos = [
      ["dni", "fecha", "nombre", "cronico", "cie10"],
      ...snapshots.flatMap((item) =>
        item.diagnoses.map((row) => [
          item.patient.document_number,
          row.date,
          row.name,
          row.chronic ? "si" : "no",
          row.cie10 ?? "",
        ])
      ),
    ];
  }

  if (include.has("medications")) {
    sheets.medicacion = [
      ["dni", "fecha", "producto", "dosis", "frecuencia", "estado", "notas"],
      ...snapshots.flatMap((item) =>
        item.medications.map((row) => [
          item.patient.document_number,
          row.date,
          row.product,
          row.dose,
          row.frequency,
          row.status,
          row.notes,
        ])
      ),
    ];
  }

  if (include.has("prescriptions")) {
    sheets.recetas = [
      ["dni", "fecha", "numero", "estado", "diagnostico", "profesional", "medicamentos"],
      ...snapshots.flatMap((item) =>
        item.prescriptions.map((row) => [
          item.patient.document_number,
          row.issued_at ?? "",
          row.prescription_number ?? "",
          row.status,
          row.diagnosis_text ?? "",
          row.professional_name ?? "",
          row.medications.map((med) => med.generic_name).join("; "),
        ])
      ),
    ];
  }

  if (include.has("orders")) {
    sheets.ordenes = [
      ["dni", "fecha", "tipo", "texto", "estado", "profesional"],
      ...snapshots.flatMap((item) =>
        item.orders.map((row) => [
          item.patient.document_number,
          row.issued_at,
          row.order_type ?? "",
          row.order_text,
          row.status,
          row.professional_name ?? "",
        ])
      ),
    ];
  }

  if (include.has("studies") || include.has("attachments")) {
    sheets.adjuntos = [
      ["dni", "archivo", "categoria", "fecha", "origen"],
      ...snapshots.flatMap((item) =>
        item.attachments
          .filter((row) =>
            row.category === "estudio" ? include.has("studies") : include.has("attachments")
          )
          .map((row) => [
            item.patient.document_number,
            row.file_name,
            row.category ?? "",
            row.document_date ?? row.created_at,
            row.source ?? "",
          ])
      ),
    ];
  }

  for (const [name, rows] of Object.entries(sheets)) {
    sheets[name] = rows.map((row) => row.map((cell) => neutralizeSpreadsheetCell(cell)));
  }
  return sheets;
}

export function countBulkExportedRecords(snapshots: ClinicalExportSnapshot[], sections: ClinicalExportSection[]): number {
  return snapshots.reduce((sum, snapshot) => {
    return sum + countExportedRecords(buildClinicalExportDocument(snapshot, sections));
  }, snapshots.length);
}

export function bulkExportNeedsClinicalLoad(
  format: BulkClinicalExportFormat,
  sections: ClinicalExportSection[]
): boolean {
  if (format === "zip" || format === "fhir" || format === "json") return true;
  return !isDemographicsOnly(sections);
}
