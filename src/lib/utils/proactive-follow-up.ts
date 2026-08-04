import { formatMonthsSince } from "@/lib/utils/pre-visit-brief";
import { mergeStandardVaccines } from "@/lib/utils/patient-chart-notes";
import type { PatientChartPayload } from "@/lib/utils/patient-chart-types";
import { buildPatientWorkspaceUrl } from "@/lib/utils/patient-workspace-actions";

export type ProactiveCareCategory =
  | "overdue_visit"
  | "diabetes_control"
  | "hypertension_followup"
  | "pending_labs"
  | "vaccination"
  | "glycemic_target";

export type ProactiveCareSeverity = "high" | "medium" | "low";

export type ProactiveCareItem = {
  id: string;
  category: ProactiveCareCategory;
  severity: ProactiveCareSeverity;
  title: string;
  detail: string;
  actionLabel?: string;
  actionHref?: string;
};

const MS_PER_MONTH = 30.44 * 24 * 60 * 60 * 1000;

function containsAny(hay: string, terms: string[]): boolean {
  const h = hay.toLowerCase();
  return terms.some((t) => h.includes(t));
}

function monthsSince(isoDate: string | null | undefined, nowMs: number): number | null {
  if (!isoDate) return null;
  const ms = nowMs - new Date(isoDate).getTime();
  if (!Number.isFinite(ms) || ms < 0) return null;
  return Math.floor(ms / MS_PER_MONTH);
}

function clinicalBlob(chart: PatientChartPayload): string {
  return [chart.chronicConditions.join(" "), chart.activeProblemsText.join(" ")].join(" ").toLowerCase();
}

function findLab(chart: PatientChartPayload, pattern: string) {
  return chart.labPanel.find((l) => l.name.toLowerCase().includes(pattern));
}

const SEVERITY_RANK: Record<ProactiveCareSeverity, number> = {
  high: 0,
  medium: 1,
  low: 2,
};

/** Rule-based proactive care items for a patient chart (Phase E). */
export function buildProactiveCareItems(input: {
  patientId: string;
  chart: PatientChartPayload;
  lastConsultAt?: string | null;
  nowMs?: number;
}): ProactiveCareItem[] {
  const nowMs = input.nowMs ?? Date.now();
  const items: ProactiveCareItem[] = [];
  const blob = clinicalBlob(input.chart);
  const months = monthsSince(input.lastConsultAt ?? null, nowMs);
  const patientHref = (opts: Parameters<typeof buildPatientWorkspaceUrl>[1]) =>
    buildPatientWorkspaceUrl(input.patientId, opts);

  if (months != null && months >= 6) {
    items.push({
      id: "overdue-visit",
      category: "overdue_visit",
      severity: months >= 12 ? "high" : "medium",
      title: "Control clínico vencido",
      detail: `Sin consulta registrada ${formatMonthsSince(input.lastConsultAt!, nowMs)}.`,
      actionLabel: "Abrir SOAP",
      actionHref: patientHref({ tab: "soap", action: "nueva" }),
    });
  }

  const isDiabetic = containsAny(blob, ["diabetes", "dm2", "dm tipo", "diabét", "diabet"]);
  const hba1c = findLab(input.chart, "hba1c");

  if (isDiabetic) {
    if (!hba1c || hba1c.status === "empty") {
      items.push({
        id: "diabetes-no-hba1c",
        category: "pending_labs",
        severity: "high",
        title: "Diabetes — HbA1c pendiente",
        detail: "No hay HbA1c reciente en la ficha. Considerar solicitar control glucémico.",
        actionLabel: "Interpretar labs",
        actionHref: patientHref({ tab: "estudios", action: "estudio" }),
      });
    } else if (hba1c.status === "high") {
      items.push({
        id: "diabetes-hba1c-high",
        category: "glycemic_target",
        severity: "high",
        title: "Control glucémico fuera de objetivo",
        detail: `HbA1c ${hba1c.value}${hba1c.unit ? ` ${hba1c.unit}` : ""} — revisar plan terapéutico.`,
        actionLabel: "Panel diabetes",
        actionHref: patientHref({ tab: "ordenes", action: "nueva" }),
      });
    } else if (months != null && months >= 6) {
      items.push({
        id: "diabetes-overdue",
        category: "diabetes_control",
        severity: "medium",
        title: "Diabetes — control anual pendiente",
        detail: "Paciente diabético sin consulta de control en los últimos 6 meses.",
        actionLabel: "Orden de control",
        actionHref: patientHref({ tab: "ordenes", action: "nueva" }),
      });
    }
  }

  const isHypertensive = containsAny(blob, ["hipertens", " hta", "hta"]);
  if (isHypertensive) {
    items.push({
      id: "hta-followup",
      category: "hypertension_followup",
      severity: months != null && months >= 6 ? "medium" : "low",
      title: "Hipertensión — verificar seguimiento",
      detail: "Registrar TA en consulta y evaluar adherencia / ajuste de tratamiento.",
      actionLabel: "Ver resumen",
      actionHref: patientHref({ tab: "resumen" }),
    });
  }

  if (input.chart.profileCompleteness.missing.includes("Laboratorio reciente")) {
    items.push({
      id: "labs-missing",
      category: "pending_labs",
      severity: "medium",
      title: "Laboratorio desactualizado",
      detail: `Perfil incompleto (${input.chart.profileCompleteness.score}%) — faltan labs recientes.`,
      actionLabel: "Ver estudios",
      actionHref: patientHref({ tab: "estudios" }),
    });
  }

  const vaccines = mergeStandardVaccines(input.chart.extras.vaccines);
  const flu = vaccines.find((v) => v.name.toLowerCase().includes("antigripal"));
  if (flu && (flu.status === "missing" || flu.status === "warn")) {
    items.push({
      id: "flu-vaccine",
      category: "vaccination",
      severity: "medium",
      title: "Vacuna antigripal pendiente",
      detail: "Registrar vacunación o indicar contraindicación en la ficha.",
      actionLabel: "Ver vacunas",
      actionHref: patientHref({ tab: "vacunas" }),
    });
  }

  for (const reminder of input.chart.reminders) {
    if (reminder.toLowerCase().includes("sin hba1c")) {
      continue;
    }
    if (!items.some((i) => i.detail === reminder)) {
      items.push({
        id: `reminder-${reminder.slice(0, 24).replace(/\s+/g, "-")}`,
        category: "pending_labs",
        severity: "low",
        title: "Recordatorio clínico",
        detail: reminder,
        actionLabel: "Abrir ficha",
        actionHref: patientHref({ tab: "resumen" }),
      });
    }
  }

  return sortProactiveCareItems(items);
}

export function sortProactiveCareItems(items: ProactiveCareItem[]): ProactiveCareItem[] {
  return [...items].sort(
    (a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity]
  );
}

export function buildProactiveCareSummaryText(items: ProactiveCareItem[]): string {
  if (items.length === 0) return "Sin alertas proactivas detectadas.";
  return items.map((i) => `• [${i.severity}] ${i.title}: ${i.detail}`).join("\n");
}

export function countProactiveCareBySeverity(items: ProactiveCareItem[]): {
  high: number;
  medium: number;
  low: number;
} {
  return items.reduce(
    (acc, item) => {
      acc[item.severity] += 1;
      return acc;
    },
    { high: 0, medium: 0, low: 0 }
  );
}
