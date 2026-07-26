export interface ClinicalCsvRow {
  lineNumber: number;
  document_number: string;
  last_name: string;
  first_name: string;
  consultation_date: string | null;
  chief_complaint: string;
  diagnosis: string;
  evolution: string;
  indications: string;
  professional_name: string;
  phone: string | null;
  insurance_provider: string | null;
  insurance_number: string | null;
  birth_date: string | null;
  import_marker: string;
}

const HEADER_MAP: Record<string, string> = {
  documento_dni: "dni",
  dni: "dni",
  documento: "dni",
  n_documento: "dni",
  apellido: "last_name",
  last_name: "last_name",
  nombre: "first_name",
  first_name: "first_name",
  fecha_consulta: "consultation_date",
  fecha: "consultation_date",
  date: "consultation_date",
  motivo: "chief_complaint",
  chief_complaint: "chief_complaint",
  motivo_consulta: "chief_complaint",
  diagnostico: "diagnosis",
  diagnosis: "diagnosis",
  evolucion: "evolution",
  evolution: "evolution",
  indicaciones: "indications",
  indications: "indications",
  plan: "indications",
  profesional: "professional_name",
  professional: "professional_name",
  medico: "professional_name",
  telefono: "phone",
  phone: "phone",
  obra_social: "insurance_provider",
  cobertura: "insurance_provider",
  insurance_provider: "insurance_provider",
  nro_afiliado: "insurance_number",
  numero_afiliado: "insurance_number",
  insurance_number: "insurance_number",
  fecha_nacimiento: "birth_date",
  birth_date: "birth_date",
};

function normalizeHeader(cell: string): string {
  return cell
    .replace(/^\uFEFF/, "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/\s+/g, "_");
}

function normalizeDni(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  if (digits.length < 7 || digits.length > 8) return null;
  return digits;
}

function detectDelimiter(line: string): "," | ";" {
  const commas = (line.match(/,/g) ?? []).length;
  const semis = (line.match(/;/g) ?? []).length;
  return semis > commas ? ";" : ",";
}

/** Parser CSV mínimo (campos entre comillas y separador , o ;). */
export function parseCsvRows(content: string): string[][] {
  const text = content.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    const next = text[i + 1];

    if (inQuotes) {
      if (ch === '"' && next === '"') {
        cell += '"';
        i += 1;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        cell += ch;
      }
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
      continue;
    }

    if (ch === "," || ch === ";") {
      row.push(cell);
      cell = "";
      continue;
    }

    if (ch === "\n") {
      row.push(cell);
      cell = "";
      if (row.some((c) => c.trim() !== "")) rows.push(row);
      row = [];
      continue;
    }

    cell += ch;
  }

  row.push(cell);
  if (row.some((c) => c.trim() !== "")) rows.push(row);

  return rows;
}

function parseDateValue(raw: string): string | null {
  const value = raw.trim();
  if (!value) return null;

  const iso = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;

  const dmy = value.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
  if (dmy) {
    const day = dmy[1].padStart(2, "0");
    const month = dmy[2].padStart(2, "0");
    return `${dmy[3]}-${month}-${day}`;
  }

  return null;
}

function titleCaseName(value: string, fallback: string): string {
  const cleaned = value.trim();
  if (!cleaned) return fallback;
  return cleaned
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(" ");
}

export function parseClinicalCsvContent(
  content: string,
  maxRows: number
): { rows: ClinicalCsvRow[]; errors: string[] } {
  const table = parseCsvRows(content);
  if (table.length < 2) {
    return { rows: [], errors: ["El CSV está vacío o solo tiene encabezados."] };
  }

  const headers = table[0].map(normalizeHeader);
  const columnIndex: Record<string, number> = {};
  headers.forEach((h, i) => {
    const mapped = HEADER_MAP[h];
    if (mapped) columnIndex[mapped] = i;
  });

  if (columnIndex.dni === undefined) {
    return {
      rows: [],
      errors: [
        "Falta la columna documento_dni (o dni). Descargá la plantilla CSV desde esta pantalla.",
      ],
    };
  }

  const rows: ClinicalCsvRow[] = [];
  const errors: string[] = [];
  const dataLines = table.slice(1);

  if (dataLines.length > maxRows) {
    return {
      rows: [],
      errors: [`El archivo supera el máximo de ${maxRows} filas de consultas por importación.`],
    };
  }

  for (let i = 0; i < dataLines.length; i += 1) {
    const line = dataLines[i];
    const lineNumber = i + 2;
    const get = (key: string) => {
      const idx = columnIndex[key];
      if (idx === undefined) return "";
      return (line[idx] ?? "").trim();
    };

    const dniRaw = line[columnIndex.dni] ?? "";
    const document_number = normalizeDni(dniRaw);
    if (!document_number) {
      errors.push(`Fila ${lineNumber}: DNI inválido (“${dniRaw}”).`);
      continue;
    }

    const consultation_date = parseDateValue(get("consultation_date"));
    const chief =
      get("chief_complaint") ||
      get("evolution") ||
      get("diagnosis") ||
      "Consulta importada desde CSV";
    const datePart = consultation_date ?? "sin-fecha";
    const import_marker = `[CsvImport:${document_number}:${datePart}:${lineNumber}]`;

    rows.push({
      lineNumber,
      document_number,
      last_name: titleCaseName(get("last_name"), "Importado"),
      first_name: titleCaseName(get("first_name"), "Csv"),
      consultation_date,
      chief_complaint: `${import_marker} ${chief}`.slice(0, 600),
      diagnosis: get("diagnosis").slice(0, 4000),
      evolution: get("evolution").slice(0, 12000),
      indications: get("indications").slice(0, 4000),
      professional_name: get("professional_name"),
      phone: get("phone") || null,
      insurance_provider: get("insurance_provider") || null,
      insurance_number: get("insurance_number") || null,
      birth_date: parseDateValue(get("birth_date")),
      import_marker,
    });
  }

  return { rows, errors };
}

export const CLINICAL_CSV_TEMPLATE = `documento_dni,apellido,nombre,fecha_consulta,motivo,diagnostico,evolucion,indicaciones,profesional,telefono,obra_social,nro_afiliado,fecha_nacimiento
3736532,Ludeña,Delicia,30/06/2026,Control de guardia,,Signos vitales estables. Febrícula 37.4°C.,Antitérmicos según necesidad.,Leonardi Oscar,+54 11 6369 8434,PAMI,15591915210100,28/12/1938
`;
