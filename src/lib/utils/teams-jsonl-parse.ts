import type { HceExportRow } from "@/lib/utils/hce-export-parse";
import { placeholderDniFromConsumerId } from "@/lib/utils/hce-export-parse";
import { normalizeDni } from "@/lib/utils/normalize-dni";
import { mapTeamsJsonlRecordToRow } from "@/lib/utils/teams-jsonl-record-mapper";

export interface TeamsJsonlConsumer {
  id: string;
  lastName?: string;
  firstName?: string;
  label?: string;
  identification?: string;
  deleted?: boolean;
}

export interface TeamsJsonlParseResult {
  rows: HceExportRow[];
  errors: string[];
  stats: {
    consumers: number;
    recordsSkipped: number;
    recordsParsed: number;
  };
}

function splitLabel(label: string): { last_name: string; first_name: string } {
  const parts = label.split(",").map((p) => p.trim());
  if (parts.length >= 2) {
    return { last_name: parts[0], first_name: parts.slice(1).join(" ") };
  }
  const space = label.trim().split(/\s+/);
  if (space.length >= 2) {
    return { last_name: space[0], first_name: space.slice(1).join(" ") };
  }
  return { last_name: label.trim() || "Importado", first_name: "Paciente" };
}

function consumerToNames(c: TeamsJsonlConsumer): { last_name: string; first_name: string } {
  const ln = c.lastName?.trim();
  const fn = c.firstName?.trim();
  if (ln || fn) {
    return { last_name: ln || "Importado", first_name: fn || "Paciente" };
  }
  if (c.label) return splitLabel(c.label);
  return { last_name: "Importado", first_name: "Paciente" };
}

type TeamsJsonlRecord = {
  id?: string;
  type?: string;
  deleted?: boolean;
  date?: string;
  startsAt?: string;
  endsAt?: string;
  status?: string;
  dx?: string;
  label?: string;
  cie10Code?: string;
  notes?: string;
  text?: string;
  content?: string;
  drug?: string;
  product?: string;
  dose?: string;
  frecuency?: string;
  presentation?: string;
  company?: string;
  link?: string;
  name?: string;
  fileName?: string;
  classification?: string;
  tas?: string;
  tad?: string;
  fc?: string;
  weight?: string;
  height?: string;
  consumers?: { id: string; label?: string }[];
};

function jsonlRecordToRow(
  rec: TeamsJsonlRecord,
  lineNumber: number,
  consumers: Map<string, TeamsJsonlConsumer>
): HceExportRow | null {
  if (rec.deleted) return null;
  const consumerRef = rec.consumers?.[0]?.id;
  if (!consumerRef || !rec.id || !rec.type) return null;

  const consumer =
    consumers.get(consumerRef) ??
    ({
      id: consumerRef,
      label: rec.consumers?.[0]?.label,
    } satisfies TeamsJsonlConsumer);

  const { last_name, first_name } = consumerToNames(consumer);
  const document_number =
    normalizeDni(consumer.identification) ?? placeholderDniFromConsumerId(consumerRef);

  return mapTeamsJsonlRecordToRow(rec, lineNumber, consumerRef, last_name, first_name, document_number);
}

export function parseTeamsJsonlContent(content: string, maxRows = 20_000): TeamsJsonlParseResult {
  const errors: string[] = [];
  const consumers = new Map<string, TeamsJsonlConsumer>();
  const rows: HceExportRow[] = [];
  let recordsSkipped = 0;
  let lineNumber = 0;

  const lines = content.split(/\r?\n/);
  for (const line of lines) {
    if (!line.trim()) continue;
    lineNumber += 1;
    let obj: { id?: string };
    try {
      obj = JSON.parse(line) as { id?: string };
    } catch {
      errors.push(`Línea ${lineNumber}: JSON inválido`);
      continue;
    }

    const id = obj.id ?? "";
    if (id.startsWith("consumers/")) {
      const c = obj as TeamsJsonlConsumer;
      if (!c.deleted) consumers.set(c.id, c);
      continue;
    }

    if (!id.startsWith("records/")) continue;

    if (rows.length >= maxRows) {
      errors.push(`Supera ${maxRows} registros clínicos por importación.`);
      break;
    }

    const row = jsonlRecordToRow(obj as TeamsJsonlRecord, lineNumber, consumers);
    if (row) rows.push(row);
    else recordsSkipped += 1;
  }

  return {
    rows,
    errors,
    stats: {
      consumers: consumers.size,
      recordsSkipped,
      recordsParsed: rows.length,
    },
  };
}

export function isTeamsJsonlFile(fileName: string, contentSample: string): boolean {
  if (/teams-.*\.jsonl$/i.test(fileName)) return true;
  const head = contentSample.slice(0, 400);
  return head.includes('"teamID":"teams/') && head.includes('"id":"');
}
