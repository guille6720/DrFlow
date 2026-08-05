import type { ClinicalWorkspaceAlert } from "@/features/pacientes/utils/clinical-workspace-alerts";
import type { PatientChartPayload } from "@/features/pacientes/utils/patient-chart-model-types";

const FOOD_ALLERGY_RE = /aliment|l[áa]ct|gluten|man[íi]|marisc|frutos secos|huevo/i;
const FALL_RISK_RE = /ca[íi]da|osteopor|movilidad reducida|adulto mayor fr[áa]gil/i;
const PREGNANCY_RE = /embaraz|gestante|puerper/i;
const IMPLANT_RE = /implante|marcapaso|pr[óo]tesis|stent|v[áa]lvula/i;
const ISOLATION_RE = /aislamiento|contacto|got[íi]cula|precauci/i;
const TRANSPLANT_RE = /transplant|injerto/i;
const DNR_RE = /\bDNR\b|no reanimar|limitaci[óo]n terap[eé]utica/i;

export function addAllergyAlerts(
  chart: PatientChartPayload,
  alerts: ClinicalWorkspaceAlert[]
): void {
  for (const allergy of chart.allergies) {
    const isFood = FOOD_ALLERGY_RE.test(allergy);
    alerts.push({
      id: `allergy-${allergy}`,
      kind: isFood ? "food_allergy" : "drug_allergy",
      label: allergy,
      severity: "critical",
    });
  }
}

export function addMedicationAlerts(
  chart: PatientChartPayload,
  alerts: ClinicalWorkspaceAlert[]
): void {
  if (chart.anticoagulated) {
    alerts.push({
      id: "anticoagulant",
      kind: "anticoagulant",
      label: "Anticoagulación activa",
      severity: "critical",
    });
  }

  for (const med of chart.criticalMeds) {
    alerts.push({
      id: `critical-med-${med}`,
      kind: "anticoagulant",
      label: `Medicación crítica: ${med}`,
      severity: "high",
    });
  }
}

export function addCriticalDiagnosisAlerts(
  chart: PatientChartPayload,
  alerts: ClinicalWorkspaceAlert[]
): void {
  for (const problem of chart.activeProblemsText.slice(0, 6)) {
    if (/diabetes|insuficiencia|cardiac|renal|oncol|VIH|c[áa]ncer/i.test(problem)) {
      alerts.push({
        id: `dx-${problem}`,
        kind: "critical_diagnosis",
        label: problem,
        severity: "high",
      });
    }
  }
}

export function addProfileRiskAlerts(
  chart: PatientChartPayload,
  alerts: ClinicalWorkspaceAlert[]
): void {
  if (chart.extras.pacemaker) {
    alerts.push({
      id: "pacemaker",
      kind: "implant",
      label: "Marcapasos / dispositivo implantado",
      severity: "high",
    });
  }

  const profileText = [
    chart.chronicConditions.join(" "),
    chart.habits.smoker,
    chart.habits.activity,
  ].join(" ");

  if (FALL_RISK_RE.test(profileText) || (chart.ageYears != null && chart.ageYears >= 75)) {
    alerts.push({
      id: "fall-risk",
      kind: "fall_risk",
      label: "Riesgo de caída",
      severity: "high",
    });
  }

  if (PREGNANCY_RE.test(profileText) || chart.sex.toLowerCase().includes("embaraz")) {
    alerts.push({
      id: "pregnancy",
      kind: "pregnancy",
      label: "Embarazo / gestación",
      severity: "critical",
    });
  }

  if (IMPLANT_RE.test(profileText)) {
    alerts.push({
      id: "implant",
      kind: "implant",
      label: "Implante / prótesis registrada",
      severity: "high",
    });
  }

  if (ISOLATION_RE.test(profileText)) {
    alerts.push({
      id: "isolation",
      kind: "isolation",
      label: "Precauciones de aislamiento",
      severity: "critical",
    });
  }

  if (TRANSPLANT_RE.test(profileText)) {
    alerts.push({
      id: "transplant",
      kind: "transplant",
      label: "Antecedente de trasplante",
      severity: "critical",
    });
  }

  if (DNR_RE.test(profileText)) {
    alerts.push({
      id: "dnr",
      kind: "dnr",
      label: "Directiva DNR / limitación terapéutica",
      severity: "critical",
    });
  }
}

export function addSafetyAndReminderAlerts(
  chart: PatientChartPayload,
  alerts: ClinicalWorkspaceAlert[]
): void {
  for (const w of chart.safetyWarnings) {
    alerts.push({
      id: `safety-${w}`,
      kind: "safety",
      label: w,
      severity: "high",
    });
  }

  for (const a of chart.alerts) {
    if (a.level === "red") {
      alerts.push({
        id: `chart-alert-${a.label}`,
        kind: "other",
        label: a.label,
        severity: "critical",
      });
    } else if (a.level === "yellow") {
      alerts.push({
        id: `chart-alert-${a.label}`,
        kind: "other",
        label: a.label,
        severity: "high",
      });
    }
  }

  for (const r of chart.reminders) {
    alerts.push({
      id: `reminder-${r}`,
      kind: "reminder",
      label: r,
      severity: "normal",
    });
  }
}

export function dedupeClinicalWorkspaceAlerts(
  alerts: ClinicalWorkspaceAlert[]
): ClinicalWorkspaceAlert[] {
  const seen = new Set<string>();
  return alerts.filter((a) => {
    const key = `${a.kind}:${a.label}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
