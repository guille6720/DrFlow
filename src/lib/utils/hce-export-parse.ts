import { parseCsvRows } from "@/lib/utils/clinical-csv-parse";

export interface HceExportRow {
  lineNumber: number;
  paciente_id: string;
  last_name: string;
  first_name: string;
  document_number: string | null;
  tipo_registro: string;
  fecha_inicio: string | null;
  fecha_fin: string | null;
  estado: string;
  diagnostico: string;
  cie10: string;
  notas: string;
  /** Id estable DrApp (`records/…`) para deduplicar import JSONL. */
  drapp_record_id?: string;
}

const HEADER_ALIASES: Record<string, keyof Omit<HceExportRow, "lineNumber">> = {
  paciente_id: "paciente_id",
  apellido: "last_name",
  nombre: "first_name",
  dni: "document_number",
  tipo_registro: "tipo_registro",
  fecha_inicio: "fecha_inicio",
  fecha_fin: "fecha_fin",
  estado: "estado",
  diagnostico: "diagnostico",
  cie10: "cie10",
  notas: "notas",
};

function normalizeDni(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  if (digits.length < 7 || digits.length > 8) return null;
  return digits;
}

export function placeholderDniFromConsumerId(paciente_id: string): string {
  const hex = paciente_id.replace(/^consumers\//i, "").replace(/[^a-f0-9]/gi, "");
  const slice = hex.slice(0, 8) || "00000000";
  const n = Number.parseInt(slice, 16);
  const base = Number.isFinite(n) ? n : slice.charCodeAt(0) * 1000;
  return String(90_000_000 + (base % 9_999_999)).padStart(8, "0");
}

export function parseHceExportCsv(content: string, maxRows: number): {
  rows: HceExportRow[];
  errors: string[];
} {
  const table = parseCsvRows(content.replace(/^\uFEFF/, ""));
  if (table.length < 2) {
    return { rows: [], errors: ["El CSV HCE está vacío."] };
  }

  const headers = table[0].map((h) => h.trim().toLowerCase());
  const col: Partial<Record<string, number>> = {};
  headers.forEach((h, i) => {
    const key = HEADER_ALIASES[h];
    if (key) col[key] = i;
  });

  if (col.paciente_id === undefined) {
    return { rows: [], errors: ["Falta columna paciente_id (export HCE)."] };
  }

  const rows: HceExportRow[] = [];
  const errors: string[] = [];
  const data = table.slice(1);

  if (data.length > maxRows) {
    return { rows: [], errors: [`Supera ${maxRows} filas por importación.`] };
  }

  for (let i = 0; i < data.length; i += 1) {
    const line = data[i];
    const get = (key: string) => {
      const idx = col[key as keyof typeof col];
      if (idx === undefined) return "";
      return (line[idx] ?? "").trim();
    };

    const paciente_id = get("paciente_id");
    if (!paciente_id) continue;

    const dniRaw = get("document_number");
    rows.push({
      lineNumber: i + 2,
      paciente_id,
      last_name: get("last_name") || "Importado",
      first_name: get("first_name") || "HCE",
      document_number: normalizeDni(dniRaw),
      tipo_registro: get("tipo_registro").toLowerCase(),
      fecha_inicio: parseIsoDate(get("fecha_inicio")),
      fecha_fin: parseIsoDate(get("fecha_fin")),
      estado: get("estado"),
      diagnostico: get("diagnostico"),
      cie10: get("cie10"),
      notas: get("notas"),
    });
  }

  return { rows, errors };
}

function parseIsoDate(raw: string): string | null {
  if (!raw) return null;
  const m = raw.match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : null;
}

export function groupHceRowsByPatient(rows: HceExportRow[]): Map<string, HceExportRow[]> {
  const map = new Map<string, HceExportRow[]>();
  for (const row of rows) {
    const list = map.get(row.paciente_id) ?? [];
    list.push(row);
    map.set(row.paciente_id, list);
  }
  return map;
}

export function buildPatientHceCsv(rows: HceExportRow[]): string {
  const header =
    "tipo_registro,fecha_inicio,fecha_fin,estado,diagnostico,cie10,notas";
  const body = rows.map((r) =>
    [
      r.tipo_registro,
      r.fecha_inicio ?? "",
      r.fecha_fin ?? "",
      r.estado,
      r.diagnostico.replace(/"/g, '""'),
      r.cie10,
      r.notas.replace(/"/g, '""'),
    ]
      .map((c) => `"${c}"`)
      .join(",")
  );
  return [header, ...body].join("\n");
}

/** CSV resumen adjunto por paciente (sin columnas de identidad). */
export function parsePatientHceSummaryCsv(content: string): HceExportRow[] {
  const table = parseCsvRows(content.replace(/^\uFEFF/, ""));
  if (table.length < 2) return [];

  const headers = table[0].map((h) => h.trim().toLowerCase());
  const col: Partial<Record<string, number>> = {};
  headers.forEach((h, i) => {
    const key = HEADER_ALIASES[h] ?? (h === "tipo_registro" ? "tipo_registro" : undefined);
    if (key) col[key] = i;
    if (h === "tipo_registro") col.tipo_registro = i;
    if (h === "fecha_inicio") col.fecha_inicio = i;
    if (h === "fecha_fin") col.fecha_fin = i;
    if (h === "estado") col.estado = i;
    if (h === "diagnostico") col.diagnostico = i;
    if (h === "cie10") col.cie10 = i;
    if (h === "notas") col.notas = i;
  });

  const rows: HceExportRow[] = [];
  for (let i = 0; i < table.length - 1; i += 1) {
    const line = table[i + 1];
    const get = (key: keyof Omit<HceExportRow, "lineNumber" | "paciente_id" | "last_name" | "first_name" | "document_number">) => {
      const idx = col[key];
      if (idx === undefined) return "";
      return (line[idx] ?? "").trim();
    };
    const tipo = get("tipo_registro").toLowerCase();
    if (!tipo) continue;
    rows.push({
      lineNumber: i + 2,
      paciente_id: "summary",
      last_name: "",
      first_name: "",
      document_number: null,
      tipo_registro: tipo,
      fecha_inicio: parseIsoDate(get("fecha_inicio")),
      fecha_fin: parseIsoDate(get("fecha_fin")),
      estado: get("estado"),
      diagnostico: get("diagnostico"),
      cie10: get("cie10"),
      notas: get("notas"),
    });
  }
  return rows;
}

export function hceRowToClinicalRecord(row: HceExportRow): {
  marker: string;
  chief_complaint: string;
  diagnosis: string;
  evolution: string;
  indications: string;
  consultation_date: string | null;
} | null {
  if (row.tipo_registro === "records" && !row.diagnostico && !row.notas && !row.fecha_inicio) {
    return null;
  }

  const marker = row.drapp_record_id
    ? `[DRAPP:${row.drapp_record_id}]`
    : `[HCE:${row.paciente_id}:${row.tipo_registro}:${row.fecha_inicio ?? "s/f"}:${row.lineNumber}]`;

  if (row.tipo_registro === "diagnostics" && row.diagnostico) {
    return {
      marker,
      chief_complaint: `${marker} Diagnóstico importado (${row.estado || "registro"})`,
      diagnosis: [row.diagnostico, row.cie10 ? `CIE-10: ${row.cie10}` : ""].filter(Boolean).join(" · "),
      evolution: row.notas,
      indications: "",
      consultation_date: row.fecha_inicio,
    };
  }

  if (row.tipo_registro === "treatments") {
    const product = row.diagnostico.trim() || row.notas.trim();
    const notes = row.notas.trim();
    return {
      marker,
      chief_complaint: `${marker} Tratamiento importado (${row.estado || "activo"})`,
      diagnosis: product,
      evolution: notes,
      indications: notes || (row.estado ? `Estado: ${row.estado}` : ""),
      consultation_date: row.fecha_inicio,
    };
  }

  if (row.tipo_registro === "vitalsigns") {
    return {
      marker,
      chief_complaint: `${marker} Signos vitales importados`,
      diagnosis: "",
      evolution: row.notas || "Registro importado desde HCE",
      indications: "",
      consultation_date: row.fecha_inicio,
    };
  }

  if (row.tipo_registro === "files") {
    return {
      marker,
      chief_complaint: `${marker} Documento adjunto importado (${row.estado || "archivo"})`,
      diagnosis: row.diagnostico,
      evolution: row.notas,
      indications: "",
      consultation_date: row.fecha_inicio,
    };
  }

  if (row.diagnostico || row.notas || row.fecha_inicio) {
    return {
      marker,
      chief_complaint: `${marker} Registro HCE (${row.tipo_registro})`,
      diagnosis: row.diagnostico,
      evolution: row.notas,
      indications: "",
      consultation_date: row.fecha_inicio,
    };
  }

  return null;
}

export function isHceStructuralChiefComplaint(chief_complaint: string | null): boolean {
  const cc = chief_complaint ?? "";
  return (
    /^\[HCE:[^\]]+\]\s*(Tratamiento|Diagnóstico) importado/i.test(cc) ||
    /^\[PDF:[^\]]+\]\s*(Tratamiento|Diagnóstico) importado/i.test(cc)
  );
}

export function filterRecordsForEhrSupplement<
  T extends { chief_complaint: string | null },
>(records: T[]): T[] {
  return records.filter((r) => !isHceStructuralChiefComplaint(r.chief_complaint));
}

export function isHceExportCsv(content: string, fileName: string): boolean {
  if (/hce_export/i.test(fileName)) return true;
  const head = content.slice(0, 500).toLowerCase();
  return head.includes("paciente_id") && head.includes("tipo_registro");
}
