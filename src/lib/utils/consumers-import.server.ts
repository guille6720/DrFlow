import "server-only";

import { logServerError } from "@/core/errors/log-error.server";

import {
  isConsumersImportHeaderCell,
  parseConsumerImportLines,
  parseConsumersCsvContent,
} from "@/lib/utils/consumers-import-parse";

export async function extractConsumerLinesFromUpload(
  buffer: Buffer,
  fileName: string
): Promise<{ lines: string[]; format: "xlsx-embedded" | "csv" | "unknown" }> {
  const lower = fileName.toLowerCase();

  if (lower.endsWith(".xlsx") || lower.endsWith(".xls") || lower.endsWith(".csv.xlsx")) {
    return extractFromExcel(buffer);
  }

  const text = buffer.toString("utf-8").replace(/^\uFEFF/, "");
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const first = lines[0] ?? "";
  if (isConsumersImportHeaderCell(first) || first.includes("firstName")) {
    return { lines, format: "csv" };
  }

  return { lines, format: "unknown" };
}

async function extractFromExcel(buffer: Buffer): Promise<{
  lines: string[];
  format: "xlsx-embedded" | "csv" | "unknown";
}> {
  const XLSX = await import("xlsx");
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const matrix = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" }) as string[][];

  if (matrix.length === 0) {
    return { lines: [], format: "unknown" };
  }

  const headerCell = String(matrix[0]?.[0] ?? "");
  if (isConsumersImportHeaderCell(headerCell)) {
    const lines = matrix
      .slice(1)
      .map((row) => String(row[0] ?? "").trim())
      .filter(Boolean);
    return { lines, format: "xlsx-embedded" };
  }

  const json = XLSX.utils.sheet_to_json<Record<string, string>>(sheet, { defval: "" });
  const lines = json.map((row) => {
    const parts = [
      row.firstName ?? row.first_name ?? "",
      row.lastName ?? row.last_name ?? "",
      row.dob ?? row.birth_date ?? "",
      row.country ?? "ar",
      row.identification ?? row.document_number ?? row.dni ?? "",
      row.gender ?? "",
      row.phones ?? row.phone ?? "",
      row.emails ?? row.email ?? "",
      row.financiers ?? row.insurance ?? "",
      row.createdAt ?? "",
      row.createdBy ?? "",
      row.teamID ?? "",
      row.id ?? "",
    ];
    return parts.map((p) => `"${String(p).replace(/"/g, '""')}"`).join(",");
  });

  return { lines, format: lines.length > 0 ? "csv" : "unknown" };
}

export async function parseConsumersUpload(buffer: Buffer, fileName: string, maxRows: number) {
  try {
    const lower = fileName.toLowerCase();
    if (lower.endsWith(".csv") && !lower.endsWith(".csv.xlsx")) {
      const text = buffer.toString("utf-8").replace(/^\uFEFF/, "");
      const firstLine = text.split(/\r?\n/)[0] ?? "";
      if (firstLine.includes("firstName") && firstLine.includes("identification")) {
        const { records, errors } = parseConsumersCsvContent(text, maxRows);
        return { records, errors, format: "csv" as const };
      }
    }

    const extracted = await extractConsumerLinesFromUpload(buffer, fileName);
    if (extracted.format === "unknown" || extracted.lines.length === 0) {
      return {
        records: [] as ReturnType<typeof parseConsumerImportLines>["records"],
        errors: ["No reconocimos el formato. Usá el export de pacientes (.xlsx o .csv)."],
        format: extracted.format,
      };
    }

    const { records, errors } = parseConsumerImportLines(extracted.lines, maxRows);
    return { records, errors, format: extracted.format };
  } catch (err) {
    logServerError("consumers-import.parse", err, { metadata: { fileName } });
    return {
      records: [] as ReturnType<typeof parseConsumerImportLines>["records"],
      errors: [
        "No pudimos leer el Excel en el servidor. Reexportá el archivo o guardá como .xlsx estándar.",
      ],
      format: "unknown" as const,
    };
  }
}
