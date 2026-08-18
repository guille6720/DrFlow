import type { NormalizedPatientImportRow } from "@/features/integraciones/lib/patient-import-normalize";

export type DuplicateMatchType = "document" | "name_dob";

export type ExistingPatientMatch = {
  id: string;
  first_name: string;
  last_name: string;
  document_number: string;
  birth_date: string | null;
  phone: string | null;
  email: string | null;
  insurance_provider: string | null;
  insurance_plan: string | null;
};

export type PatientDuplicateCandidate = {
  lineNumber: number;
  matchType: DuplicateMatchType;
  incoming: NormalizedPatientImportRow;
  existing: ExistingPatientMatch;
  diffs: Array<{ field: string; existing: string; incoming: string }>;
};

export type DuplicateDecision = "keep" | "update" | "create" | "skip" | "review";

export type DuplicateDecisionSet = {
  exactDefault: DuplicateDecision;
  possibleDefault: DuplicateDecision;
  byLine: Record<string, DuplicateDecision>;
};

export function defaultDuplicateDecisions(): DuplicateDecisionSet {
  return { exactDefault: "keep", possibleDefault: "review", byLine: {} };
}

export function resolveDuplicateDecision(
  decisions: DuplicateDecisionSet,
  lineNumber: number,
  matchType: DuplicateMatchType | null
): DuplicateDecision {
  const override = decisions.byLine[String(lineNumber)];
  if (override) return override;
  if (matchType === "document") return decisions.exactDefault;
  if (matchType === "name_dob") return decisions.possibleDefault;
  return "create";
}

function nameKey(last: string, first: string, birth: string | null): string {
  return `${last.trim().toLowerCase()}|${first.trim().toLowerCase()}|${birth ?? ""}`;
}

function diffFields(
  existing: ExistingPatientMatch,
  incoming: NormalizedPatientImportRow
): Array<{ field: string; existing: string; incoming: string }> {
  const pairs: Array<[string, string | null, string | null]> = [
    ["Nombre", existing.first_name, incoming.first_name],
    ["Apellido", existing.last_name, incoming.last_name],
    ["Nacimiento", existing.birth_date, incoming.birth_date],
    ["Teléfono", existing.phone, incoming.phone],
    ["Email", existing.email, incoming.email],
    ["Cobertura", existing.insurance_provider, incoming.insurance_provider],
    ["Plan", existing.insurance_plan, incoming.insurance_plan],
  ];
  return pairs
    .filter(([, a, b]) => (a ?? "") !== (b ?? "") && Boolean(b))
    .map(([field, existingValue, incomingValue]) => ({
      field,
      existing: existingValue || "—",
      incoming: incomingValue || "—",
    }));
}

export function detectPatientDuplicates(
  incoming: NormalizedPatientImportRow[],
  existing: ExistingPatientMatch[]
): PatientDuplicateCandidate[] {
  const byDocument = new Map<string, ExistingPatientMatch>();
  const byNameDob = new Map<string, ExistingPatientMatch>();

  for (const patient of existing) {
    if (patient.document_number) byDocument.set(patient.document_number, patient);
    byNameDob.set(nameKey(patient.last_name, patient.first_name, patient.birth_date), patient);
  }

  const candidates: PatientDuplicateCandidate[] = [];

  for (const row of incoming) {
    if (!row.document_number) continue;
    const exact = byDocument.get(row.document_number);
    if (exact) {
      candidates.push({
        lineNumber: row.lineNumber,
        matchType: "document",
        incoming: row,
        existing: exact,
        diffs: diffFields(exact, row),
      });
      continue;
    }

    if (row.birth_date) {
      const fuzzy = byNameDob.get(nameKey(row.last_name, row.first_name, row.birth_date));
      if (fuzzy) {
        candidates.push({
          lineNumber: row.lineNumber,
          matchType: "name_dob",
          incoming: row,
          existing: fuzzy,
          diffs: diffFields(fuzzy, row),
        });
      }
    }
  }

  return candidates;
}
