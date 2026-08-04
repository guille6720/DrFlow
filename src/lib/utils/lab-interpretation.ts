import type { PatientChartExtras } from "@/features/pacientes/utils/patient-chart-model-types";
import type { PhysicianAssistItem, PhysicianAssistKind } from "@/features/ia/types/physician-assist-types";

export type ParsedLabValue = {
  name: string;
  value: number;
  unit?: string;
  rawValue: string;
};

export type LabComparisonRow = {
  name: string;
  current: string;
  previous?: string;
  deltaLabel?: string;
  status: "normal" | "high" | "low" | "unknown";
  trend?: "up" | "down" | "stable" | "new";
};

type LabReference = {
  patterns: string[];
  label: string;
  low?: number;
  high?: number;
};

const LAB_REFERENCES: LabReference[] = [
  { patterns: ["hba1c", "hemoglobina glicosilada"], label: "HbA1c", low: 4, high: 5.7 },
  { patterns: ["glucemia", "glucosa", "glicemia"], label: "Glucemia", low: 70, high: 100 },
  { patterns: ["creatinina"], label: "Creatinina", low: 0.6, high: 1.2 },
  { patterns: ["ldl", "colesterol ldl"], label: "LDL", low: 0, high: 100 },
  { patterns: ["colesterol total", "colesterol"], label: "Colesterol", low: 0, high: 200 },
  { patterns: ["hemoglobina"], label: "Hemoglobina", low: 12, high: 16 },
  { patterns: ["leucocitos"], label: "Leucocitos", low: 4000, high: 11000 },
  { patterns: ["triglic", "triglicer"], label: "Triglicéridos", low: 0, high: 150 },
];

function stableId(kind: PhysicianAssistKind, seed: string): string {
  return `${kind}-${seed.slice(0, 48).replace(/\s+/g, "-")}`;
}

function normalizeName(raw: string): string {
  return raw.trim().replace(/\s+/g, " ");
}

function matchReference(name: string): LabReference | undefined {
  const key = name.toLowerCase();
  return LAB_REFERENCES.find((ref) => ref.patterns.some((p) => key.includes(p)));
}

function parseNumericValue(raw: string): number | null {
  const cleaned = raw.replace(",", ".").match(/-?\d+(?:\.\d+)?/);
  if (!cleaned) return null;
  const n = parseFloat(cleaned[0]);
  return Number.isFinite(n) ? n : null;
}

/** Extract structured lab values from OCR / pasted PDF text (rule-based). */
export function parseLabValuesFromText(text: string): ParsedLabValue[] {
  const results: ParsedLabValue[] = [];
  const seen = new Set<string>();

  const nameFirst =
    /(hba1c|hemoglobina glicosilada|glucemia|glucosa|glicemia|creatinina|ldl|colesterol(?:\s+total|\s+ldl)?|triglic[eé]ridos|hemoglobina|leucocitos)\s*[:\-]?\s*([\d.,]+)\s*(%|mg\/dl|mg\/dL|g\/dl|g\/dL|mmol\/l|x10³|x10\^3)?/gi;

  let match: RegExpExecArray | null;
  while ((match = nameFirst.exec(text)) !== null) {
    const nameRaw = match[1];
    const valueRaw = match[2];
    const unit = match[3];
    if (!nameRaw || !valueRaw) continue;

    const value = parseNumericValue(valueRaw);
    if (value == null) continue;

    const ref = matchReference(nameRaw);
    const name = ref?.label ?? normalizeName(nameRaw);
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);

    results.push({
      name,
      value,
      unit: unit?.trim() || undefined,
      rawValue: valueRaw,
    });
  }

  const valueFirst =
    /([\d.,]+)\s*(%|mg\/dl|mg\/dL|g\/dL)\s*(?:de\s+)?(hba1c|hemoglobina glicosilada)/gi;

  while ((match = valueFirst.exec(text)) !== null) {
    const valueRaw = match[1];
    const unit = match[2];
    const nameRaw = match[3];
    if (!nameRaw || !valueRaw) continue;

    const value = parseNumericValue(valueRaw);
    if (value == null) continue;

    const ref = matchReference(nameRaw);
    const name = ref?.label ?? normalizeName(nameRaw);
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);

    results.push({
      name,
      value,
      unit: unit?.trim() || undefined,
      rawValue: valueRaw,
    });
  }

  return results;
}

export function classifyLabValue(name: string, value: number): LabComparisonRow["status"] {
  const ref = matchReference(name);
  if (!ref) return "unknown";
  if (ref.low != null && value < ref.low) return "low";
  if (ref.high != null && value > ref.high) return "high";
  return "normal";
}

function formatLabDisplay(row: ParsedLabValue): string {
  return row.unit ? `${row.value} ${row.unit}` : String(row.value);
}

function parsePreviousNumeric(value: string): number | null {
  return parseNumericValue(value);
}

/** Compare parsed labs with chart history. */
export function compareLabsWithHistory(
  parsed: ParsedLabValue[],
  previousLabs: PatientChartExtras["labs"] = []
): LabComparisonRow[] {
  const byName = new Map(
    (previousLabs ?? []).map((l) => [l.name.toLowerCase(), l])
  );

  return parsed.map((current) => {
    const prev = byName.get(current.name.toLowerCase()) ??
      [...byName.entries()].find(([k]) => current.name.toLowerCase().includes(k.slice(0, 4)))?.[1];

    const status = classifyLabValue(current.name, current.value);
    const currentStr = formatLabDisplay(current);

    if (!prev?.value) {
      return { name: current.name, current: currentStr, status, trend: "new" as const };
    }

    const prevNum = parsePreviousNumeric(prev.value);
    let deltaLabel: string | undefined;
    let trend: LabComparisonRow["trend"] = "stable";

    if (prevNum != null) {
      const diff = current.value - prevNum;
      if (Math.abs(diff) >= 0.05) {
        trend = diff > 0 ? "up" : "down";
        deltaLabel = `${diff > 0 ? "+" : ""}${diff.toFixed(2)} vs anterior (${prev.value}${prev.unit ? ` ${prev.unit}` : ""})`;
      } else {
        deltaLabel = `Estable vs anterior (${prev.value})`;
      }
    }

    return {
      name: current.name,
      current: currentStr,
      previous: prev.value + (prev.unit ? ` ${prev.unit}` : ""),
      deltaLabel,
      status,
      trend,
    };
  });
}

/** Build interpretation assist item from parsed labs. */
export function buildLabInterpretationItem(input: {
  sourceText: string;
  previousLabs?: PatientChartExtras["labs"];
}): PhysicianAssistItem | null {
  const parsed = parseLabValuesFromText(input.sourceText);
  if (parsed.length === 0) return null;

  const comparisons = compareLabsWithHistory(parsed, input.previousLabs);
  const abnormal = comparisons.filter((c) => c.status === "high" || c.status === "low");

  const lines = [
    "Resumen de laboratorio (interpretación asistida):",
    ...comparisons.map((c) => {
      const flag = c.status === "high" ? " ↑" : c.status === "low" ? " ↓" : "";
      const trend = c.deltaLabel ? ` — ${c.deltaLabel}` : "";
      return `• ${c.name}: ${c.current}${flag}${trend}`;
    }),
  ];

  if (abnormal.length > 0) {
    lines.push("", "Fuera de rango de referencia (revisar contexto clínico):");
    for (const row of abnormal) {
      lines.push(`• ${row.name} (${row.status === "high" ? "alto" : "bajo"})`);
    }
  }

  lines.push("", "Verificar unidades, ayuno y correlación clínica antes de decidir.");

  const body = lines.join("\n");
  return {
    id: stableId("lab_interpretation", body),
    kind: "lab_interpretation",
    title: "Interpretación de laboratorio",
    body,
  };
}

export function buildLabInterpretationPlainText(comparisons: LabComparisonRow[]): string {
  return comparisons
    .map((c) => {
      const flag = c.status !== "normal" ? ` [${c.status}]` : "";
      return `${c.name}: ${c.current}${flag}${c.deltaLabel ? ` (${c.deltaLabel})` : ""}`;
    })
    .join("\n");
}
