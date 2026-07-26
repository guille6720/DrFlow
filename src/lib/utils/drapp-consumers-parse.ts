import { parseCsvRows } from "@/lib/utils/clinical-csv-parse";

export interface DrAppConsumerRecord {
  lineNumber: number;
  first_name: string;
  last_name: string;
  birth_date: string | null;
  document_number: string;
  phone: string | null;
  email: string | null;
  insurance_provider: string | null;
  insurance_number: string | null;
  drapp_consumer_id: string | null;
}

const DRAPP_HEADER_MARKER = "firstName";
const DRAPP_ID_MARKER = "identification";

function normalizeDni(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  if (digits.length < 7 || digits.length > 8) return null;
  return digits;
}

function parseFinanciers(raw: string): { insurance_provider: string | null; insurance_number: string | null } {
  const value = raw.trim();
  if (!value) return { insurance_provider: null, insurance_number: null };

  const pamiMatch = value.match(/PAMI\s*#?\s*(\d{10,20})/i);
  if (pamiMatch) {
    return { insurance_provider: "PAMI", insurance_number: pamiMatch[1] };
  }
  if (/^PAMI$/i.test(value)) {
    return { insurance_provider: "PAMI", insurance_number: null };
  }

  return { insurance_provider: value.slice(0, 80), insurance_number: null };
}

function titleCase(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(" ");
}

/** Línea export DrApp (comillas escapadas con \\") en una sola celda. */
export function normalizeDrAppConsumerLine(raw: string): string {
  return raw.replace(/\\"/g, '"').trim();
}

export function isDrAppConsumersHeaderCell(cell: string): boolean {
  const normalized = normalizeDrAppConsumerLine(cell);
  return normalized.includes(DRAPP_HEADER_MARKER) && normalized.includes(DRAPP_ID_MARKER);
}

export function parseDrAppConsumerLine(
  raw: string,
  lineNumber: number
): { record: DrAppConsumerRecord } | { error: string } {
  const normalized = normalizeDrAppConsumerLine(raw);
  if (isDrAppConsumersHeaderCell(normalized)) {
    return { error: `Fila ${lineNumber}: encabezado omitido.` };
  }

  const row = parseCsvRows(`${normalized}\n`)[0];
  if (!row || row.length < 5) {
    return { error: `Fila ${lineNumber}: formato DrApp inválido.` };
  }

  const [
    firstName,
    lastName,
    dob,
    ,
    identification,
    ,
    phones,
    emails,
    financiers,
    ,
    ,
    ,
    consumerId,
  ] = row;

  const document_number = normalizeDni(identification ?? "");
  if (!document_number) {
    return { error: `Fila ${lineNumber}: DNI inválido (“${identification ?? ""}”).` };
  }

  const { insurance_provider, insurance_number } = parseFinanciers(financiers ?? "");
  const birth_date = (dob ?? "").trim().match(/^\d{4}-\d{2}-\d{2}/)
    ? (dob ?? "").trim().slice(0, 10)
    : null;

  return {
    record: {
      lineNumber,
      first_name: titleCase(firstName || "Importado"),
      last_name: titleCase(lastName || "DrApp"),
      birth_date,
      document_number,
      phone: (phones ?? "").trim() || null,
      email: (emails ?? "").trim() || null,
      insurance_provider,
      insurance_number,
      drapp_consumer_id: (consumerId ?? "").trim() || null,
    },
  };
}

export function parseDrAppConsumerLines(
  lines: string[],
  maxRows: number
): { records: DrAppConsumerRecord[]; errors: string[] } {
  const records: DrAppConsumerRecord[] = [];
  const errors: string[] = [];
  let dataLines = 0;

  for (let i = 0; i < lines.length; i += 1) {
    const raw = lines[i]?.trim();
    if (!raw) continue;
    if (isDrAppConsumersHeaderCell(raw)) continue;

    dataLines += 1;
    if (dataLines > maxRows) {
      errors.push(`Supera el máximo de ${maxRows} pacientes por importación.`);
      break;
    }

    const parsed = parseDrAppConsumerLine(raw, i + 1);
    if ("error" in parsed) {
      errors.push(parsed.error);
      continue;
    }
    records.push(parsed.record);
  }

  return { records, errors };
}
