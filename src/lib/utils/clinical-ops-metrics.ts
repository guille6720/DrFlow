import { differenceInMinutes, differenceInYears } from "date-fns";
import type {
  ClinicalOpsActionableAlert,
  ClinicalOpsActivityMetrics,
  ClinicalOpsEnrichedWaitingRow,
  ClinicalOpsLabResult,
  ClinicalOpsWaitingPriority,
} from "@/lib/utils/clinical-operations-types";
import type { LiveAppointment } from "@/lib/utils/clinical-operations-types";

const LAB_FILENAME_RE =
  /lab(oratorio)?|hemograma|glucosa|glu\b|creatinina|urea|tsh|hba1c|pcr|hepatic|renal|orina|sangre|bioquim/i;

export function computePatientAge(
  birthDate: string | null | undefined,
  now = new Date()
): number | null {
  if (!birthDate) return null;
  const parsed = new Date(birthDate);
  if (Number.isNaN(parsed.getTime())) return null;
  return differenceInYears(now, parsed);
}

export function computeWaitingMinutes(startAt: string, now = new Date()): number {
  return Math.max(0, differenceInMinutes(now, new Date(startAt)));
}

export function waitingPriority(
  startAt: string,
  waitingRoomStatus: string | null | undefined,
  hasCriticalAllergy: boolean,
  now = new Date()
): ClinicalOpsWaitingPriority {
  if (hasCriticalAllergy) return "urgent";
  if (startAt < now.toISOString()) return "high";
  if (waitingRoomStatus === "called") return "high";
  return "normal";
}

export function computeActivityMetrics(input: {
  todayAppointments: LiveAppointment[];
  waiting: LiveAppointment[];
  now?: Date;
}): ClinicalOpsActivityMetrics {
  const now = input.now ?? new Date();
  const nowIso = now.toISOString();

  const attendedCount = input.todayAppointments.filter((a) => a.status === "attended").length;
  const delayed = input.todayAppointments.filter(
    (a) =>
      a.start_at < nowIso &&
      a.status !== "attended" &&
      a.status !== "cancelled" &&
      a.status !== "no_show"
  );

  const waitingMinutes = input.waiting.map((w) => computeWaitingMinutes(w.start_at, now));
  const averageWaitingMinutes =
    waitingMinutes.length > 0
      ? Math.round(waitingMinutes.reduce((sum, m) => sum + m, 0) / waitingMinutes.length)
      : null;

  const nextAppointment =
    input.todayAppointments.find(
      (a) =>
        a.start_at >= nowIso &&
        a.status !== "attended" &&
        a.status !== "cancelled" &&
        a.status !== "no_show"
    ) ?? null;

  return {
    waitingCount: input.waiting.length,
    attendedCount,
    averageWaitingMinutes,
    nextAppointment,
    delayedCount: delayed.length,
  };
}

export function isLikelyLabFile(fileName: string): boolean {
  return LAB_FILENAME_RE.test(fileName);
}

export function prioritizeLabResults(
  studies: Array<{
    id: string;
    file_name: string;
    created_at: string;
    patient_id: string;
    patients: { first_name: string; last_name: string } | null;
  }>,
  now = new Date()
): ClinicalOpsLabResult[] {
  return studies
    .map((study) => {
      const isLab = isLikelyLabFile(study.file_name);
      const isRecent = differenceInMinutes(now, new Date(study.created_at)) <= 48 * 60;
      const severity: ClinicalOpsLabResult["severity"] =
        isLab && isRecent ? "review" : isLab ? "normal" : "normal";
      return {
        ...study,
        severity,
        isLab,
      };
    })
    .sort((a, b) => {
      const rank = (s: ClinicalOpsLabResult) =>
        s.severity === "critical" ? 0 : s.severity === "review" ? 1 : 2;
      if (rank(a) !== rank(b)) return rank(a) - rank(b);
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
}

export function enrichWaitingRows(input: {
  waiting: LiveAppointment[];
  allergiesByPatient: Map<string, string | null>;
  now?: Date;
}): ClinicalOpsEnrichedWaitingRow[] {
  const now = input.now ?? new Date();

  return input.waiting
    .map((row) => {
      const allergies =
        row.patient_id != null ? input.allergiesByPatient.get(row.patient_id) ?? null : null;
      const hasCriticalAllergy = Boolean(allergies?.trim());
      const birthDate =
        row.patients && "birth_date" in row.patients
          ? (row.patients as { birth_date?: string | null }).birth_date
          : null;

      return {
        id: row.id,
        start_at: row.start_at,
        waiting_room_status: row.waiting_room_status ?? null,
        status: row.status,
        patient_id: row.patient_id ?? null,
        professional_id: row.professional_id ?? null,
        notes: (row as { notes?: string | null }).notes ?? null,
        patients: row.patients
          ? {
              first_name: row.patients.first_name,
              last_name: row.patients.last_name,
              document_number:
                "document_number" in row.patients
                  ? (row.patients as { document_number?: string }).document_number
                  : undefined,
              phone: row.patients.phone,
              birth_date: birthDate ?? null,
            }
          : null,
        professionals: row.professionals,
        age: computePatientAge(birthDate, now),
        waitingMinutes: computeWaitingMinutes(row.start_at, now),
        allergies,
        priority: waitingPriority(row.start_at, row.waiting_room_status, hasCriticalAllergy, now),
        alerts: buildRowAlerts(allergies, row.start_at, now),
      };
    })
    .sort((a, b) => {
      const priorityRank: Record<ClinicalOpsWaitingPriority, number> = {
        urgent: 0,
        high: 1,
        normal: 2,
      };
      if (priorityRank[a.priority] !== priorityRank[b.priority]) {
        return priorityRank[a.priority] - priorityRank[b.priority];
      }
      return b.waitingMinutes - a.waitingMinutes;
    });
}

function buildRowAlerts(
  allergies: string | null | undefined,
  startAt: string,
  now: Date
): string[] {
  const alerts: string[] = [];
  if (allergies?.trim()) alerts.push(`Alergia: ${allergies.trim()}`);
  if (startAt < now.toISOString()) alerts.push("Turno demorado");
  return alerts;
}

export function buildActionableAlerts(input: {
  criticalPatients: Array<{
    id: string;
    first_name: string;
    last_name: string;
    reason: string;
  }>;
  overdue: LiveAppointment[];
  enrichedWaiting: ClinicalOpsEnrichedWaitingRow[];
}): ClinicalOpsActionableAlert[] {
  const alerts: ClinicalOpsActionableAlert[] = [];

  for (const appt of input.overdue) {
    const name = appt.patients
      ? `${appt.patients.last_name}, ${appt.patients.first_name}`
      : "Paciente";
    alerts.push({
      id: `overdue-${appt.id}`,
      kind: "delayed_appointment",
      title: "Turno demorado",
      detail: name,
      patientId: appt.patient_id,
      href: appt.patient_id ? `/pacientes/${appt.patient_id}?tab=soap&action=nueva&appointment=${appt.id}` : "/agenda?view=day",
      severity: "high",
    });
  }

  for (const p of input.criticalPatients) {
    alerts.push({
      id: `critical-${p.id}`,
      kind: "medication_allergy",
      title: "Alerta clínica",
      detail: `${p.last_name}, ${p.first_name} · ${p.reason}`,
      patientId: p.id,
      href: `/pacientes/${p.id}?tab=resumen`,
      severity: "critical",
    });
  }

  for (const row of input.enrichedWaiting.filter((w) => w.priority === "urgent")) {
    if (input.criticalPatients.some((p) => p.id === row.patient_id)) continue;
    const name = row.patients
      ? `${row.patients.last_name}, ${row.patients.first_name}`
      : "Paciente";
    alerts.push({
      id: `urgent-wait-${row.id}`,
      kind: "urgent_waiting",
      title: "Paciente urgente en espera",
      detail: name,
      patientId: row.patient_id,
      href: row.patient_id
        ? `/pacientes/${row.patient_id}?tab=soap&action=nueva&appointment=${row.id}`
        : "/sala-espera",
      severity: "high",
    });
  }

  return alerts
    .sort((a, b) => {
      const rank = (s: ClinicalOpsActionableAlert["severity"]) =>
        s === "critical" ? 0 : s === "high" ? 1 : 2;
      return rank(a.severity) - rank(b.severity);
    })
    .slice(0, 12);
}

export function summarizeMedications(medications: unknown): string {
  if (!Array.isArray(medications) || medications.length === 0) return "Sin medicación";
  const first = medications[0] as { name?: string; drug?: string; medication?: string };
  const label = first.name ?? first.drug ?? first.medication ?? "Medicación";
  if (medications.length === 1) return label;
  return `${label} +${medications.length - 1}`;
}
