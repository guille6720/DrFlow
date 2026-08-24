const FORMULA_PREFIX = /^[=+\-@\t\r]/;

/** Neutralize CSV/Excel formula injection on export cells. */
export function neutralizeSpreadsheetCell(value: unknown): string {
  const text = value == null ? "" : String(value);
  if (FORMULA_PREFIX.test(text) || text.startsWith("\t")) {
    return `'${text}`;
  }
  return text;
}

export function toCsvLine(cells: unknown[]): string {
  return cells
    .map((cell) => {
      const safe = neutralizeSpreadsheetCell(cell).replace(/"/g, '""');
      return `"${safe}"`;
    })
    .join(",");
}

export function toCsvDocument(rows: unknown[][]): string {
  return `\uFEFF${rows.map((row) => toCsvLine(row)).join("\n")}`;
}

export function sanitizeExportFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]+/g, "_").replace(/\.{2,}/g, ".").slice(0, 120);
}
