import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  detectPatientDuplicates,
  type DuplicateDecisionSet,
  type ExistingPatientMatch,
  type PatientDuplicateCandidate,
} from "@/features/integraciones/lib/patient-import-duplicates";
import { type PatientColumnMapping } from "@/features/integraciones/lib/patient-import-mapping";
import { trimImportValue } from "@/features/integraciones/lib/patient-import-normalize";
import { parsePatientSpreadsheet } from "@/features/integraciones/lib/patient-import-spreadsheet";
import {
  mapSpreadsheetRow,
  type PatientImportIssue,
  validatePatientImportRow,
} from "@/features/integraciones/lib/patient-import-validate";
import type { PatientImportStats } from "@/features/integraciones/server/data-import-types";

import { CONSUMERS_IMPORT_MAX_ROWS } from "@/lib/constants/clinical-documents";

const DOCUMENT_IN_CHUNK = 200;
const SAMPLE_LIMIT = 80;

export type PreparedPatientImport = {
  stats: PatientImportStats;
  issues: PatientImportIssue[];
  duplicates: PatientDuplicateCandidate[];
  readyRows: ReturnType<typeof mapSpreadsheetRow>[];
};

function readMappedRaw(
  cells: Record<string, string>,
  mapping: PatientColumnMapping,
  field: keyof PatientColumnMapping
): string {
  const header = mapping[field];
  if (!header) return "";
  return trimImportValue(cells[header]);
}

export async function preparePatientImportFromBuffer(
  supabase: SupabaseClient,
  clinicId: string,
  buffer: Buffer,
  fileName: string,
  mapping: PatientColumnMapping,
  dateFormat?: string | null
): Promise<PreparedPatientImport> {
  const table = await parsePatientSpreadsheet(buffer, fileName);
  const issues: PatientImportIssue[] = [];
  const mappedRows = [];

  const dataRows = table.rows.slice(0, CONSUMERS_IMPORT_MAX_ROWS);
  if (table.rows.length > CONSUMERS_IMPORT_MAX_ROWS) {
    issues.push({
      lineNumber: CONSUMERS_IMPORT_MAX_ROWS + 2,
      code: "empty_row",
      message: `Supera el máximo de ${CONSUMERS_IMPORT_MAX_ROWS} pacientes por importación.`,
    });
  }

  for (let i = 0; i < dataRows.length; i += 1) {
    const lineNumber = i + 2;
    const cells = dataRows[i];
    const row = mapSpreadsheetRow(cells, mapping, lineNumber, dateFormat);
    const rowIssues = validatePatientImportRow(row, {
      document: readMappedRaw(cells, mapping, "document_number"),
      birthDate: readMappedRaw(cells, mapping, "birth_date"),
    });
    if (rowIssues.length > 0) {
      issues.push(...rowIssues);
      continue;
    }
    mappedRows.push(row);
  }

  const existing = await loadExistingPatientsForMatch(supabase, clinicId, mappedRows);
  const duplicates = detectPatientDuplicates(mappedRows, existing);
  const duplicateLines = new Set(duplicates.map((item) => item.lineNumber));
  const readyRows = mappedRows.filter((row) => !duplicateLines.has(row.lineNumber));

  return {
    stats: {
      total: dataRows.length,
      ready: readyRows.length,
      duplicates: duplicates.length,
      invalid: issues.length,
    },
    issues: issues.slice(0, SAMPLE_LIMIT),
    duplicates: duplicates.slice(0, SAMPLE_LIMIT),
    readyRows,
  };
}

async function loadExistingPatientsForMatch(
  supabase: SupabaseClient,
  clinicId: string,
  incoming: ReturnType<typeof mapSpreadsheetRow>[]
): Promise<ExistingPatientMatch[]> {
  const documents = [
    ...new Set(incoming.map((row) => row.document_number).filter((value): value is string => Boolean(value))),
  ];
  const lastNames = [
    ...new Set(incoming.map((row) => row.last_name).filter(Boolean)),
  ].slice(0, 400);

  const found = new Map<string, ExistingPatientMatch>();

  for (let i = 0; i < documents.length; i += DOCUMENT_IN_CHUNK) {
    const chunk = documents.slice(i, i + DOCUMENT_IN_CHUNK);
    const { data } = await supabase
      .from("patients")
      .select(
        "id, first_name, last_name, document_number, birth_date, phone, email, insurance_provider, insurance_plan"
      )
      .eq("clinic_id", clinicId)
      .in("document_number", chunk);
    for (const row of data ?? []) found.set(row.id, row as ExistingPatientMatch);
  }

  for (let i = 0; i < lastNames.length; i += DOCUMENT_IN_CHUNK) {
    const chunk = lastNames.slice(i, i + DOCUMENT_IN_CHUNK);
    const { data } = await supabase
      .from("patients")
      .select(
        "id, first_name, last_name, document_number, birth_date, phone, email, insurance_provider, insurance_plan"
      )
      .eq("clinic_id", clinicId)
      .in("last_name", chunk)
      .limit(2000);
    for (const row of data ?? []) found.set(row.id, row as ExistingPatientMatch);
  }

  return [...found.values()];
}

export function withDefaultDecisions(
  value: DuplicateDecisionSet | null | undefined
): DuplicateDecisionSet {
  return {
    exactDefault: value?.exactDefault ?? "keep",
    possibleDefault: value?.possibleDefault ?? "review",
    byLine: value?.byLine ?? {},
  };
}
