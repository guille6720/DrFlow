import {
  addAllergyAlerts,
  addCriticalDiagnosisAlerts,
  addMedicationAlerts,
  addProfileRiskAlerts,
  addSafetyAndReminderAlerts,
  dedupeClinicalWorkspaceAlerts,
} from "@/features/pacientes/utils/clinical-workspace-alerts.helpers";
import type { PatientChartPayload } from "@/features/pacientes/utils/patient-chart-model-types";
import type { PatientEhrConsultation } from "@/features/pacientes/utils/patient-ehr-model";

export type ClinicalWorkspaceAlert = {
  id: string;
  kind:
    | "drug_allergy"
    | "food_allergy"
    | "critical_diagnosis"
    | "fall_risk"
    | "pregnancy"
    | "anticoagulant"
    | "implant"
    | "isolation"
    | "transplant"
    | "dnr"
    | "safety"
    | "reminder"
    | "other";
  label: string;
  severity: "critical" | "high" | "normal";
};

export function buildClinicalWorkspaceAlerts(chart: PatientChartPayload): ClinicalWorkspaceAlert[] {
  const alerts: ClinicalWorkspaceAlert[] = [];
  addAllergyAlerts(chart, alerts);
  addMedicationAlerts(chart, alerts);
  addCriticalDiagnosisAlerts(chart, alerts);
  addProfileRiskAlerts(chart, alerts);
  addSafetyAndReminderAlerts(chart, alerts);
  return dedupeClinicalWorkspaceAlerts(alerts);
}

export type LastConsultSummary = {
  id: string;
  dateLabel: string;
  professionalName: string;
  chiefComplaint: string;
  assessment: string;
  plan: string;
  diagnoses: string;
  prescriptions: string;
  orders: string;
  followUp: string;
};

export function buildLastConsultSummary(
  consultation: PatientEhrConsultation | undefined,
  prescriptionLabels: string[],
  orderLabels: string[]
): LastConsultSummary | null {
  if (!consultation) return null;

  return {
    id: consultation.id,
    dateLabel: new Date(consultation.created_at).toLocaleDateString("es-AR", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }),
    professionalName: consultation.professional_name ?? "Profesional",
    chiefComplaint: consultation.chief_complaint?.trim() || "—",
    assessment: consultation.evolution?.trim() || consultation.diagnosis?.trim() || "—",
    plan: consultation.indications?.trim() || "—",
    diagnoses: consultation.diagnosis?.trim() || "—",
    prescriptions: prescriptionLabels.length ? prescriptionLabels.join(" · ") : "—",
    orders: orderLabels.length ? orderLabels.join(" · ") : "—",
    followUp: consultation.indications?.trim() || "—",
  };
}

export function detectMedicationFlags(medications: PatientChartPayload["medications"]): string[] {
  const flags: string[] = [];
  const names = medications.map((m) => m.name.toLowerCase());

  const duplicates = names.filter((n, i) => names.indexOf(n) !== i);
  if (duplicates.length > 0) {
    flags.push(`Posible duplicación: ${[...new Set(duplicates)].join(", ")}`);
  }

  const anticoagCount = names.filter((n) =>
    /warfarina|acenocumarol|rivaroxaban|apixaban|heparina|enoxaparina/i.test(n)
  ).length;
  if (anticoagCount > 1) {
    flags.push("Múltiples anticoagulantes detectados");
  }

  if (medications.some((m) => /venc|expir|renov/i.test(m.lastRenewalLabel))) {
    flags.push("Revisar renovaciones pendientes");
  }

  return flags;
}
