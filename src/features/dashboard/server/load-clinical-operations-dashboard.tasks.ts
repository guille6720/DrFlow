import { isHrefEntitledBySnapshot } from "@/core/entitlements/nav-features";
import type { ClientEntitlementsSnapshot } from "@/core/entitlements/types";
import { unwrapJoin } from "@/core/supabase/unwrap-join";

import { isUnattendedAppointment, LIST_LIMIT } from "@/features/dashboard/server/load-clinical-operations-dashboard.helpers";
import type { ClinicalOpsTask } from "@/features/dashboard/utils/clinical-operations-dashboard-types";
import type { LiveAppointment } from "@/features/dashboard/utils/clinical-operations-types";
import type { ClinicalOperationsPayload } from "@/features/dashboard/utils/clinical-operations-types";
import { patientWorkspacePath } from "@/features/pacientes/constants/patient-workspace-tabs";
import { buildPatientWorkspaceUrl } from "@/features/pacientes/utils/patient-workspace-actions";

function patientDisplayName(appt: LiveAppointment): string {
  return appt.patients ? `${appt.patients.last_name}, ${appt.patients.first_name}` : "Paciente";
}

function buildAppointmentTasks(
  todayAppointments: LiveAppointment[],
  nowIso: string,
  tasks: ClinicalOpsTask[]
): void {
  for (const appt of todayAppointments) {
    const name = patientDisplayName(appt);
    if (appt.start_at < nowIso && isUnattendedAppointment(appt.status) && appt.patient_id) {
      tasks.push({
        id: `task-overdue-${appt.id}`,
        kind: "overdue_appointment",
        label: "Atender turno demorado",
        detail: name,
        at: appt.start_at,
        href: buildPatientWorkspaceUrl(appt.patient_id, {
          tab: "soap",
          action: "nueva",
          appointment: appt.id,
          professional: appt.professional_id ?? undefined,
        }),
        priority: "high",
      });
    }
    if (appt.status === "pending" && appt.patient_id) {
      tasks.push({
        id: `task-confirm-${appt.id}`,
        kind: "confirm_appointment",
        label: "Confirmar turno pendiente",
        detail: name,
        at: appt.start_at,
        href: "/agenda?view=day",
        priority: "normal",
      });
    }
  }
}

function buildPrescriptionTasks(
  draftPrescriptions: ClinicalOperationsPayload["draftPrescriptions"],
  tasks: ClinicalOpsTask[]
): void {
  for (const rx of draftPrescriptions) {
    const name = rx.patients ? `${rx.patients.last_name}, ${rx.patients.first_name}` : "Paciente";
    tasks.push({
      id: `task-rx-${rx.id}`,
      kind: "draft_prescription",
      label: "Emitir receta borrador",
      detail: name,
      at: rx.created_at,
      href: buildPatientWorkspaceUrl(rx.patient_id, { tab: "recetas", action: "nueva" }),
      priority: "normal",
    });
  }
}

function buildStudyTasks(
  pendingStudies: ClinicalOperationsPayload["pendingStudies"],
  tasks: ClinicalOpsTask[]
): void {
  for (const study of pendingStudies.slice(0, 5)) {
    const name = study.patients ? `${study.patients.last_name}, ${study.patients.first_name}` : "Paciente";
    tasks.push({
      id: `task-study-${study.id}`,
      kind: "pending_study",
      label: "Revisar estudio adjunto",
      detail: `${name} · ${study.file_name}`,
      at: study.created_at,
      href: patientWorkspacePath(study.patient_id, "estudios"),
      priority: "normal",
    });
  }
}

function buildReminderTasks(
  queuedReminders: Array<{
    id: string;
    created_at: string;
    channel: string;
    appointment_id: string | null;
    appointments?: { start_at: string; patients?: { first_name: string; last_name: string } | null } | null;
  }>,
  tasks: ClinicalOpsTask[]
): void {
  for (const log of queuedReminders) {
    const appt = log.appointments;
    const p = unwrapJoin(appt?.patients ?? null);
    const name = p ? `${p.last_name}, ${p.first_name}` : "Paciente";
    tasks.push({
      id: `task-reminder-${log.id}`,
      kind: "queued_reminder",
      label: "Recordatorio en cola",
      detail: `${name} · ${log.channel}`,
      at: appt?.start_at ?? log.created_at,
      href: "/recordatorios",
      priority: "normal",
    });
  }
}

export function buildTasks(input: {
  todayAppointments: LiveAppointment[];
  nowIso: string;
  draftPrescriptions: ClinicalOperationsPayload["draftPrescriptions"];
  pendingStudies: ClinicalOperationsPayload["pendingStudies"];
  queuedReminders: Array<{
    id: string;
    created_at: string;
    channel: string;
    appointment_id: string | null;
    appointments?: { start_at: string; patients?: { first_name: string; last_name: string } | null } | null;
  }>;
  entitlements?: ClientEntitlementsSnapshot | null;
}): ClinicalOpsTask[] {
  const tasks: ClinicalOpsTask[] = [];
  buildAppointmentTasks(input.todayAppointments, input.nowIso, tasks);
  buildPrescriptionTasks(input.draftPrescriptions, tasks);
  buildStudyTasks(input.pendingStudies, tasks);
  buildReminderTasks(input.queuedReminders, tasks);

  const snapshot = input.entitlements ?? null;

  return tasks
    .filter((task) => isHrefEntitledBySnapshot(task.href, snapshot))
    .sort((a, b) => {
      if (a.priority !== b.priority) return a.priority === "high" ? -1 : 1;
      return new Date(a.at).getTime() - new Date(b.at).getTime();
    })
    .slice(0, LIST_LIMIT);
}
