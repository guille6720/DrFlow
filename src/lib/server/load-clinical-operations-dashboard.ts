import type { SupabaseClient } from "@supabase/supabase-js";
import { endOfDay, startOfDay } from "date-fns";
import type { LiveAppointment } from "@/lib/utils/clinical-operations-types";
import type { ClinicalOperationsPayload } from "@/lib/utils/clinical-operations-types";
import type {
  ClinicalOperationsDashboardPayload,
  ClinicalOpsTask,
} from "@/lib/utils/clinical-operations-dashboard-types";
import { buildPatientWorkspaceUrl } from "@/lib/utils/patient-workspace-actions";
import { patientWorkspacePath } from "@/lib/constants/patient-workspace-tabs";

const APPOINTMENT_SELECT =
  "id, start_at, status, booking_source, notes, patient_id, professional_id, waiting_room_status, patients(first_name, last_name, phone, document_number), professionals(profiles(full_name))";

const LIST_LIMIT = 8;

function mapPatient<T>(value: T | T[] | null): T | null {
  if (value == null) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
}

function buildTasks(input: {
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
}): ClinicalOpsTask[] {
  const tasks: ClinicalOpsTask[] = [];

  for (const appt of input.todayAppointments) {
    const name = appt.patients
      ? `${appt.patients.last_name}, ${appt.patients.first_name}`
      : "Paciente";
    if (
      appt.start_at < input.nowIso &&
      appt.status !== "attended" &&
      appt.status !== "cancelled" &&
      appt.status !== "no_show" &&
      appt.patient_id
    ) {
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

  for (const rx of input.draftPrescriptions) {
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

  for (const study of input.pendingStudies.slice(0, 5)) {
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

  for (const log of input.queuedReminders) {
    const appt = log.appointments;
    const p = mapPatient(appt?.patients ?? null);
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

  return tasks
    .sort((a, b) => {
      if (a.priority !== b.priority) return a.priority === "high" ? -1 : 1;
      return new Date(a.at).getTime() - new Date(b.at).getTime();
    })
    .slice(0, LIST_LIMIT);
}

/** Single parallel fetch for the clinical operations dashboard (<2s target). */
export async function loadClinicalOperationsDashboard(
  supabase: SupabaseClient,
  clinicId: string
): Promise<ClinicalOperationsDashboardPayload> {
  const now = new Date();
  const nowIso = now.toISOString();
  const todayStart = startOfDay(now).toISOString();
  const todayEnd = endOfDay(now).toISOString();
  const studiesSince = new Date(Date.now() - 7 * 86400000).toISOString();

  const [todayResult, upcomingResult, draftRx, pendingStudies, queuedReminders] = await Promise.all([
    supabase
      .from("appointments")
      .select(APPOINTMENT_SELECT)
      .eq("clinic_id", clinicId)
      .gte("start_at", todayStart)
      .lte("start_at", todayEnd)
      .not("status", "eq", "cancelled")
      .order("start_at"),
    supabase
      .from("appointments")
      .select(APPOINTMENT_SELECT)
      .eq("clinic_id", clinicId)
      .gte("start_at", nowIso)
      .not("status", "in", '("cancelled","attended")')
      .order("start_at")
      .limit(LIST_LIMIT),
    supabase
      .from("prescription_drafts")
      .select("id, created_at, patient_id, patients(first_name, last_name, document_number)")
      .eq("clinic_id", clinicId)
      .eq("status", "draft")
      .order("created_at", { ascending: false })
      .limit(LIST_LIMIT),
    supabase
      .from("patient_attachments")
      .select("id, file_name, created_at, patient_id, patients(first_name, last_name)")
      .eq("clinic_id", clinicId)
      .gte("created_at", studiesSince)
      .order("created_at", { ascending: false })
      .limit(LIST_LIMIT),
    supabase
      .from("reminder_logs")
      .select(
        "id, created_at, channel, appointment_id, appointments(start_at, patients(first_name, last_name))"
      )
      .eq("clinic_id", clinicId)
      .eq("status", "queued")
      .gte("created_at", todayStart)
      .order("created_at", { ascending: false })
      .limit(LIST_LIMIT),
  ]);

  const todayAppointments = (todayResult.data ?? []) as unknown as LiveAppointment[];
  const upcoming = (upcomingResult.data ?? []) as unknown as LiveAppointment[];
  const patientIds = [
    ...new Set(todayAppointments.map((a) => a.patient_id).filter((id): id is string => Boolean(id))),
  ];

  const criticalRows =
    patientIds.length > 0
      ? await supabase
          .from("patient_clinical_profiles")
          .select(
            "patient_id, allergies, regular_medication, patients(first_name, last_name, document_number)"
          )
          .eq("clinic_id", clinicId)
          .in("patient_id", patientIds)
          .or("allergies.not.is.null,regular_medication.not.is.null")
      : { data: [] };

  const waiting = todayAppointments.filter(
    (a) =>
      a.status !== "attended" &&
      a.status !== "cancelled" &&
      a.status !== "no_show" &&
      (a.waiting_room_status === "waiting" ||
        a.waiting_room_status === "called" ||
        !a.waiting_room_status)
  ) as ClinicalOperationsPayload["waiting"];

  const overdue = todayAppointments.filter(
    (a) =>
      a.start_at < nowIso &&
      a.status !== "attended" &&
      a.status !== "cancelled" &&
      a.status !== "no_show"
  ) as ClinicalOperationsPayload["overdue"];

  const notifications: ClinicalOperationsPayload["notifications"] = [];

  for (const appt of todayAppointments) {
    const name = appt.patients
      ? `${appt.patients.last_name}, ${appt.patients.first_name}`
      : "Paciente";
    if (appt.status === "no_show") {
      notifications.push({
        id: `ns-${appt.id}`,
        kind: "no_show",
        label: "Ausencia registrada",
        at: appt.start_at,
        patientName: name,
        href: "/agenda?view=day",
      });
    }
    if (appt.status === "cancelled") {
      notifications.push({
        id: `cx-${appt.id}`,
        kind: "cancelled",
        label: "Turno cancelado",
        at: appt.start_at,
        patientName: name,
        href: "/agenda?view=day",
      });
    }
  }

  for (const appt of overdue.slice(0, 5)) {
    const name = appt.patients
      ? `${appt.patients.last_name}, ${appt.patients.first_name}`
      : "Paciente";
    notifications.push({
      id: `od-${appt.id}`,
      kind: "overdue",
      label: "Turno demorado",
      at: appt.start_at,
      patientName: name,
      href: appt.patient_id
        ? buildPatientWorkspaceUrl(appt.patient_id, {
            tab: "soap",
            action: "nueva",
            appointment: appt.id,
          })
        : "/agenda?view=day",
    });
  }

  const criticalPatients = (criticalRows.data ?? [])
    .map((row) => {
      const patient = mapPatient(row.patients as
        | { first_name: string; last_name: string; document_number: string }
        | { first_name: string; last_name: string; document_number: string }[]
        | null);
      if (!patient) return null;

      const reasons: string[] = [];
      if (row.allergies?.trim()) reasons.push(`Alergias: ${row.allergies.trim()}`);
      if (/anticoag|warfarina|acenocumarol|heparina|apixaban|rivaroxaban/i.test(row.regular_medication ?? "")) {
        reasons.push("Anticoagulación");
      }
      if (reasons.length === 0) return null;
      return {
        id: row.patient_id,
        first_name: patient.first_name,
        last_name: patient.last_name,
        document_number: patient.document_number,
        allergies: row.allergies,
        reason: reasons.join(" · "),
      };
    })
    .filter(Boolean) as ClinicalOperationsPayload["criticalPatients"];

  const draftPrescriptions: ClinicalOperationsPayload["draftPrescriptions"] = (draftRx.data ?? []).map(
    (row) => {
      const patient = mapPatient(row.patients as
        | { first_name: string; last_name: string; document_number: string }
        | { first_name: string; last_name: string; document_number: string }[]
        | null);
      return {
        id: String(row.id),
        created_at: String(row.created_at),
        patient_id: String(row.patient_id),
        patients: patient,
      };
    }
  );

  const pendingStudiesMapped: ClinicalOperationsPayload["pendingStudies"] = (
    pendingStudies.data ?? []
  ).map((row) => {
    const patient = mapPatient(row.patients as
      | { first_name: string; last_name: string }
      | { first_name: string; last_name: string }[]
      | null);
    return {
      id: String(row.id),
      file_name: String(row.file_name),
      created_at: String(row.created_at),
      patient_id: String(row.patient_id),
      patients: patient,
    };
  });

  const queuedRemindersMapped = (queuedReminders.data ?? []).map((row) => {
    const apptRaw = row.appointments as
      | { start_at: string; patients?: { first_name: string; last_name: string } | { first_name: string; last_name: string }[] | null }
      | { start_at: string; patients?: { first_name: string; last_name: string } | { first_name: string; last_name: string }[] | null }[]
      | null;
    const appt = mapPatient(apptRaw);
    const patient = mapPatient(appt?.patients ?? null);
    return {
      id: String(row.id),
      created_at: String(row.created_at),
      channel: String(row.channel),
      appointment_id: row.appointment_id ? String(row.appointment_id) : null,
      appointments: appt
        ? {
            start_at: appt.start_at,
            patients: patient,
          }
        : null,
    };
  });

  const tasks = buildTasks({
    todayAppointments,
    nowIso,
    draftPrescriptions,
    pendingStudies: pendingStudiesMapped,
    queuedReminders: queuedRemindersMapped,
  });

  return {
    waiting,
    upcoming,
    overdue,
    draftPrescriptions,
    pendingStudies: pendingStudiesMapped,
    criticalPatients,
    notifications: notifications.slice(0, LIST_LIMIT),
    todayAppointments,
    tasks,
  };
}
