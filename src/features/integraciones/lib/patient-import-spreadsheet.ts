import { parseCsvRows } from "@/lib/utils/clinical-csv-parse";

export type SpreadsheetTable = {
  headers: string[];
  rows: Record<string, string>[];
};

function decodeCsvBuffer(buffer: Buffer): string {
  if (buffer.length >= 2 && buffer[0] === 0xff && buffer[1] === 0xfe) {
    return buffer.toString("utf16le").replace(/^\uFEFF/, "");
  }
  const utf8 = buffer.toString("utf8").replace(/^\uFEFF/, "");
  const replacementCount = (utf8.match(/\uFFFD/g) ?? []).length;
  if (replacementCount > 8) {
    return buffer.toString("latin1").replace(/^\uFEFF/, "");
  }
  return utf8;
}

function uniqueHeaders(raw: string[]): string[] {
  const seen = new Map<string, number>();
  return raw.map((header, index) => {
    const base = header.trim() || `columna_${index + 1}`;
    const count = seen.get(base) ?? 0;
    seen.set(base, count + 1);
    return count === 0 ? base : `${base}_${count + 1}`;
  });
}

function tableFromMatrix(matrix: unknown[][]): SpreadsheetTable {
  if (matrix.length === 0) {
    throw new Error("La planilla está vacía.");
  }

  const headerRow = (matrix[0] ?? []).map((cell) => String(cell ?? "").trim());
  if (headerRow.every((cell) => !cell)) {
    throw new Error("No encontramos encabezados en la primera fila.");
  }

  const headers = uniqueHeaders(headerRow);
  const rows: Record<string, string>[] = [];

  for (let i = 1; i < matrix.length; i += 1) {
    const line = matrix[i] ?? [];
    const record: Record<string, string> = {};
    let empty = true;
    headers.forEach((header, col) => {
      const value = stringifyCell(line[col]);
      record[header] = value;
      if (value) empty = false;
    });
    if (!empty) rows.push(record);
  }

  if (rows.length === 0) {
    throw new Error("La planilla no tiene filas de datos.");
  }

  return { headers, rows };
}

function stringifyCell(value: unknown): string {
  if (value == null) return "";
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }
  return String(value).replace(/\u0000/g, "").trim();
}

export async function parsePatientSpreadsheet(
  buffer: Buffer,
  fileName: string
): Promise<SpreadsheetTable> {
  const lower = fileName.toLowerCase();

  if (lower.endsWith(".csv") && !lower.endsWith(".csv.xlsx")) {
    const text = decodeCsvBuffer(buffer);
    if (!text.trim()) throw new Error("El archivo CSV está vacío.");
    const matrix = parseCsvRows(text);
    return tableFromMatrix(matrix);
  }

  const XLSX = await import("xlsx");
  let workbook: ReturnType<typeof XLSX.read>;
  try {
    workbook = XLSX.read(buffer, {
      type: "buffer",
      cellFormula: false,
      cellHTML: false,
      cellStyles: false,
      sheetStubs: true,
    });
  } catch {
    throw new Error("No pudimos leer el Excel. Reexportalo como .xlsx o .csv.");
  }

  const sheetName = workbook.SheetNames[0];
  if (!sheetName) throw new Error("El Excel no tiene hojas.");
  const sheet = workbook.Sheets[sheetName];
  const matrix = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    defval: "",
    raw: true,
    blankrows: false,
  }) as unknown[][];

  return tableFromMatrix(matrix);
}
