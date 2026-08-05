import type { HceExportRow } from "@/lib/utils/hce-export-parse";
import { sanitizeClinicalDisplayText } from "@/lib/utils/sanitize-clinical-display";

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
};

function parseIsoDate(raw: string | undefined): string | null {
  if (!raw) return null;
  const m = raw.match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : null;
}

function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<\/li>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&oacute;/gi, "ó")
    .replace(/&aacute;/gi, "á")
    .replace(/&eacute;/gi, "é")
    .replace(/&iacute;/gi, "í")
    .replace(/&uacute;/gi, "ú")
    .replace(/&ntilde;/gi, "ñ")
    .replace(/\s+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

function buildBaseRow(
  rec: TeamsJsonlRecord,
  lineNumber: number,
  consumerRef: string,
  last_name: string,
  first_name: string,
  document_number: string
): HceExportRow {
  const tipo = rec.type === "vitalSigns" ? "vitalsigns" : rec.type!.toLowerCase();
  return {
    lineNumber,
    paciente_id: consumerRef,
    last_name,
    first_name,
    document_number,
    tipo_registro: tipo,
    fecha_inicio: parseIsoDate(rec.date ?? rec.startsAt),
    fecha_fin: parseIsoDate(rec.endsAt),
    estado: rec.status ?? "",
    diagnostico: "",
    cie10: rec.cie10Code ?? "",
    notas: "",
    import_record_id: rec.id!,
  };
}

function mapDiagnosticsRecord(base: HceExportRow, rec: TeamsJsonlRecord): HceExportRow | null {
  const clean = (s: string) => sanitizeClinicalDisplayText(s);
  base.diagnostico = clean((rec.dx ?? rec.label ?? "").trim());
  base.notas = clean((rec.notes ?? "").trim());
  base.estado = rec.status ?? "registro";
  return base.diagnostico ? base : null;
}

function mapTreatmentsRecord(base: HceExportRow, rec: TeamsJsonlRecord): HceExportRow | null {
  const clean = (s: string) => sanitizeClinicalDisplayText(s);
  const label = (rec.label ?? "").trim();
  const drugLine = [rec.drug, rec.product, rec.presentation].filter(Boolean).join(" · ");
  base.diagnostico = label || drugLine;
  base.notas = clean(
    [rec.dose, rec.frecuency, rec.notes, rec.company ? `Lab: ${rec.company}` : ""]
      .filter(Boolean)
      .join(" · ")
  );
  base.estado = rec.status ?? "activo";
  return base.diagnostico || base.notas ? base : null;
}

function mapRecordsRecord(base: HceExportRow, rec: TeamsJsonlRecord): HceExportRow | null {
  const clean = (s: string) => sanitizeClinicalDisplayText(s);
  const body = stripHtml(rec.content ?? rec.text ?? "");
  if (!body && !base.fecha_inicio) return null;
  base.notas = clean(body);
  return base;
}

function mapVitalsRecord(base: HceExportRow, rec: TeamsJsonlRecord): HceExportRow | null {
  const parts = [
    rec.tas && rec.tad ? `TA ${rec.tas}/${rec.tad}` : rec.tas ? `TAS ${rec.tas}` : "",
    rec.fc ? `FC ${rec.fc}` : "",
    rec.weight ? `Peso ${rec.weight} kg` : "",
    rec.height ? `Talla ${rec.height} cm` : "",
  ].filter(Boolean);
  base.notas = parts.join(" · ") || "Signos vitales";
  return base;
}

function mapFilesRecord(base: HceExportRow, rec: TeamsJsonlRecord): HceExportRow | null {
  const clean = (s: string) => sanitizeClinicalDisplayText(s);
  base.diagnostico = (rec.name ?? rec.fileName ?? "Archivo").trim();
  base.notas = clean([rec.link, rec.notes].filter(Boolean).join("\n"));
  base.estado = rec.classification ?? rec.status ?? "archivo";
  return base;
}

function mapFallbackRecord(base: HceExportRow, rec: TeamsJsonlRecord): HceExportRow | null {
  const clean = (s: string) => sanitizeClinicalDisplayText(s);
  const fallback = stripHtml(rec.content ?? rec.text ?? rec.notes ?? "");
  if (!fallback && !rec.label) return null;
  base.diagnostico = (rec.label ?? "").trim();
  base.notas = clean(fallback);
  return base;
}

export function mapTeamsJsonlRecordToRow(
  rec: TeamsJsonlRecord,
  lineNumber: number,
  consumerRef: string,
  last_name: string,
  first_name: string,
  document_number: string
): HceExportRow | null {
  const base = buildBaseRow(rec, lineNumber, consumerRef, last_name, first_name, document_number);
  const tipo = base.tipo_registro;

  if (tipo === "diagnostics") return mapDiagnosticsRecord(base, rec);
  if (tipo === "treatments") return mapTreatmentsRecord(base, rec);
  if (tipo === "records") return mapRecordsRecord(base, rec);
  if (tipo === "vitalsigns") return mapVitalsRecord(base, rec);
  if (tipo === "files") return mapFilesRecord(base, rec);
  return mapFallbackRecord(base, rec);
}
