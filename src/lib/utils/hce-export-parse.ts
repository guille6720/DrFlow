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
    return { rows: [], errors: ["Falta columna paciente_id (export HCE DrApp)."] };
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

  const marker = `[HCE:${row.paciente_id}:${row.tipo_registro}:${row.fecha_inicio ?? "s/f"}:${row.lineNumber}]`;

  if (row.tipo_registro === "diagnostics" && row.diagnostico) {
    return {
      marker,
      chief_complaint: `${marker} Diagnóstico DrApp (${row.estado || "registro"})`,
      diagnosis: [row.diagnostico, row.cie10 ? `CIE-10: ${row.cie10}` : ""].filter(Boolean).join(" · "),
      evolution: row.notas,
      indications: "",
      consultation_date: row.fecha_inicio,
    };
  }

  if (row.tipo_registro === "treatments") {
    return {
      marker,
      chief_complaint: `${marker} Tratamiento DrApp (${row.estado || "activo"})`,
      diagnosis: row.diagnostico,
      evolution: row.notas,
      indications: row.estado ? `Estado: ${row.estado}` : "Importado desde export HCE DrApp",
      consultation_date: row.fecha_inicio,
    };
  }

  if (row.tipo_registro === "vitalsigns") {
    return {
      marker,
      chief_complaint: `${marker} Signos vitales DrApp`,
      diagnosis: "",
      evolution: row.notas || "Registro importado desde HCE DrApp",
      indications: "",
      consultation_date: row.fecha_inicio,
    };
  }

  if (row.tipo_registro === "files") {
    return {
      marker,
      chief_complaint: `${marker} Documento adjunto DrApp (${row.estado || "archivo"})`,
      diagnosis: row.diagnostico,
      evolution: row.notas,
      indications: "",
      consultation_date: row.fecha_inicio,
    };
  }

  if (row.diagnostico || row.notas || row.fecha_inicio) {
    return {
      marker,
      chief_complaint: `${marker} Registro HCE DrApp (${row.tipo_registro})`,
      diagnosis: row.diagnostico,
      evolution: row.notas,
      indications: "",
      consultation_date: row.fecha_inicio,
    };
  }

  return null;
}

export function isHceExportCsv(content: string, fileName: string): boolean {
  if (/hce_export/i.test(fileName)) return true;
  const head = content.slice(0, 500).toLowerCase();
  return head.includes("paciente_id") && head.includes("tipo_registro");
}
