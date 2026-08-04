import type { ChartAlert, PatientChartPayload } from "@/features/pacientes/utils/patient-chart-model-types";
import type { LabPanelRow } from "@/features/pacientes/utils/patient-chart-notes";

export type PreVisitBriefSection = {
  label: string;
  value: string;
  tone?: "default" | "warning" | "critical";
};

export type PreVisitBrief = {
  headline: string;
  sections: PreVisitBriefSection[];
  alertLines: string[];
  plainText: string;
};

const MS_PER_MONTH = 30.44 * 24 * 60 * 60 * 1000;

/** Relative label for last encounter, e.g. "hace 3 meses". */
export function formatMonthsSince(isoDate: string, nowMs = Date.now()): string {
  const ms = nowMs - new Date(isoDate).getTime();
  if (!Number.isFinite(ms) || ms < 0) return "reciente";
  const months = Math.floor(ms / MS_PER_MONTH);
  if (months < 1) return "hace menos de 1 mes";
  if (months === 1) return "hace 1 mes";
  return `hace ${months} meses`;
}

function findLabRow(labPanel: LabPanelRow[], patterns: string[]): LabPanelRow | undefined {
  for (const row of labPanel) {
    const key = row.name.toLowerCase();
    if (patterns.some((p) => key.includes(p))) return row;
  }
  return undefined;
}

function formatLabValue(row: LabPanelRow | undefined): string | null {
  if (!row || row.status === "empty" || !row.value?.trim() || row.value === "—") return null;
  const unit = row.unit?.trim();
  return unit ? `${row.value} ${unit}` : row.value;
}

function buildLabHighlights(chart: PatientChartPayload): string {
  const hba1c = formatLabValue(findLabRow(chart.labPanel, ["hba1c"]));
  const ldl =
    formatLabValue(findLabRow(chart.labPanel, ["ldl"])) ??
    formatLabValue(findLabRow(chart.labPanel, ["colesterol"]));

  const parts: string[] = [];
  if (hba1c) parts.push(`HbA1c ${hba1c}`);
  else parts.push("HbA1c —");
  if (ldl) parts.push(`LDL ${ldl}`);
  else parts.push("LDL —");
  return parts.join(" · ");
}

function buildConditionLabel(chart: PatientChartPayload): string {
  const fromProblems = chart.activeProblemsText.filter(Boolean);
  if (fromProblems.length > 0) return fromProblems.slice(0, 5).join(", ");
  const chronic = chart.chronicConditions.filter(Boolean);
  if (chronic.length > 0) return chronic.slice(0, 5).join(", ");
  return "Sin registrar";
}

function buildMedicationLabel(chart: PatientChartPayload): string {
  const names = chart.medications.map((m) => m.name).filter(Boolean);
  if (names.length === 0) return "Sin registrar";
  if (names.length <= 5) return names.join(", ");
  return `${names.slice(0, 5).join(", ")} (+${names.length - 5})`;
}

function buildAlertLines(chart: PatientChartPayload): string[] {
  const lines: string[] = [];

  for (const alert of chart.alerts) {
    if (alert.level === "red" || alert.level === "yellow") {
      lines.push(alert.label);
    }
  }

  for (const reminder of chart.reminders) {
    lines.push(reminder);
  }

  for (const warning of chart.safetyWarnings.slice(0, 2)) {
    lines.push(warning);
  }

  const seen = new Set<string>();
  return lines.filter((line) => {
    const key = line.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function resolveLastConsultLabel(
  lastConsultAt: string | null | undefined,
  chart: PatientChartPayload,
  nowMs: number
): string {
  if (lastConsultAt) {
    return formatMonthsSince(lastConsultAt, nowMs);
  }

  const dateLabel = chart.consultations[0]?.dateLabel;
  if (dateLabel) {
    const parts = dateLabel.split("/");
    if (parts.length === 3) {
      const [dd, mm, yyyy] = parts.map((p) => parseInt(p, 10));
      if (Number.isFinite(dd) && Number.isFinite(mm) && Number.isFinite(yyyy)) {
        const iso = new Date(yyyy, mm - 1, dd).toISOString();
        return formatMonthsSince(iso, nowMs);
      }
    }
    return dateLabel;
  }

  const overdueReminder = chart.reminders.find((r) => r.includes("sin control hace"));
  if (overdueReminder) {
    const match = overdueReminder.match(/hace (\d+) meses/);
    if (match) return `hace ${match[1]} meses`;
  }

  return "Sin consultas registradas";
}

function buildPlainText(brief: Omit<PreVisitBrief, "plainText">): string {
  const lines = [brief.headline];
  for (const section of brief.sections) {
    lines.push(`${section.label}: ${section.value}`);
  }
  if (brief.alertLines.length > 0) {
    lines.push(`Alertas: ${brief.alertLines.join("; ")}`);
  }
  return lines.join("\n");
}

/** Structured ~10 s pre-visit brief from chart payload (rule-based, no LLM). */
export function buildPreVisitBrief(input: {
  patientName: string;
  chart: PatientChartPayload;
  lastConsultAt?: string | null;
  nowMs?: number;
}): PreVisitBrief {
  const nowMs = input.nowMs ?? Date.now();
  const headline = `${input.patientName} · ${input.chart.ageLabel}`;

  const sections: PreVisitBriefSection[] = [
    { label: "Condiciones", value: buildConditionLabel(input.chart) },
    {
      label: "Alergias",
      value: input.chart.allergies.length > 0 ? input.chart.allergies.join(", ") : "Sin registrar",
      tone: input.chart.allergies.length > 0 ? "warning" : "default",
    },
    { label: "Última consulta", value: resolveLastConsultLabel(input.lastConsultAt, input.chart, nowMs) },
    { label: "Labs destacados", value: buildLabHighlights(input.chart) },
    { label: "Medicación", value: buildMedicationLabel(input.chart) },
  ];

  const alertLines = buildAlertLines(input.chart);

  const brief = { headline, sections, alertLines };
  return { ...brief, plainText: buildPlainText(brief) };
}

/** Maps chart alert levels to brief section tone. */
export function alertLevelToTone(level: ChartAlert["level"]): PreVisitBriefSection["tone"] {
  if (level === "red") return "critical";
  if (level === "yellow") return "warning";
  return "default";
}
