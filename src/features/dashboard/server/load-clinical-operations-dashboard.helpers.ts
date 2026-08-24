import type { SupabaseClient } from "@supabase/supabase-js";

import { unwrapJoin } from "@/core/supabase/unwrap-join";

import type { LiveAppointment } from "@/features/dashboard/utils/clinical-operations-types";
import type { ClinicalOperationsPayload } from "@/features/dashboard/utils/clinical-operations-types";
import { summarizeMedications } from "@/features/dashboard/utils/clinical-ops-metrics";
import { buildPatientWorkspaceUrl } from "@/features/pacientes/utils/patient-workspace-actions";

export const APPOINTMENT_SELECT =
  "id, start_at, status, booking_source, notes, patient_id, professional_id, waiting_room_status, waiting_room_entered_at, patients(first_name, last_name, phone, document_number, birth_date), professionals(profiles(full_name))";

/** Fallback when optional columns or nested joins fail in production (schema drift). */
export const APPOINTMENT_SELECT_MINIMAL =
  "id, start_at, status, notes, patient_id, professional_id, patients(first_name, last_name, phone, document_number, birth_date)";

export const UPCOMING_APPOINTMENT_STATUSES = ["pending", "confirmed"] as const;

export const LIST_LIMIT = 8;
/** Cap busy-clinic day payload for clinical ops dashboard. */
export const TODAY_APPOINTMENTS_LIMIT = 200;

type PatientNameRef = { first_name: string; last_name: string } | null;

/** Avoid `"null"` / invalid timestamps breaking date-fns in dashboard widgets. */
export function sanitizeIsoTimestamp(value: unknown): string {
  if (value == null || value === "") return new Date(0).toISOString();
  const iso = typeof value === "string" ? value : String(value);
  if (iso === "null" || iso === "undefined" || Number.isNaN(Date.parse(iso))) {
    return new Date(0).toISOString();
  }
  return iso;
}

function appointmentPatientName(appt: LiveAppointment): string {
  return appt.patients ? `${appt.patients.last_name}, ${appt.patients.first_name}` : "Paciente";
}

export function isUnattendedAppointment(status: string): boolean {
  return status !== "attended" && status !== "cancelled" && status !== "no_show";
}

export function isWaitingRoomCandidate(appt: LiveAppointment): boolean {
  if (!isUnattendedAppointment(appt.status)) return false;
  if (!appt.waiting_room_entered_at) return false;
  return (
    appt.waiting_room_status === "waiting" ||
    appt.waiting_room_status === "confirmed" ||
    appt.waiting_room_status === "called"
  );
}

export function filterWaitingAppointments(
  appointments: LiveAppointment[]
): ClinicalOperationsPayload["waiting"] {
  return appointments.filter(isWaitingRoomCandidate) as ClinicalOperationsPayload["waiting"];
}

export function filterOverdueAppointments(
  appointments: LiveAppointment[],
  nowIso: string
): ClinicalOperationsPayload["overdue"] {
  return appointments.filter(
    (a) => a.start_at < nowIso && isUnattendedAppointment(a.status)
  ) as ClinicalOperationsPayload["overdue"];
}

export function collectWaitingPatientIds(appointments: LiveAppointment[]): string[] {
  return [
    ...new Set(
      appointments
        .filter(isWaitingRoomCandidate)
        .map((a) => a.patient_id)
        .filter((id): id is string => Boolean(id))
    ),
  ];
}

export async function fetchDashboardPrimaryQueries(
  supabase: SupabaseClient,
  clinicId: string,
  todayStart: string,
  todayEnd: string,
  nowIso: string,
  studiesSince: string
) {
  const [core, secondary] = await Promise.all([
    fetchDashboardCoreQueries(supabase, clinicId, todayStart, todayEnd, nowIso),
    fetchDashboardSecondaryQueries(supabase, clinicId, todayStart, studiesSince),
  ]);
  const [todayResult, upcomingResult] = core;
  const [draftRx, pendingStudies, queuedReminders, pendingOrdersResult] = secondary;
  return [todayResult, upcomingResult, draftRx, pendingStudies, queuedReminders, pendingOrdersResult] as const;
}

export async function fetchDashboardCoreQueries(
  supabase: SupabaseClient,
  clinicId: string,
  todayStart: string,
  todayEnd: string,
  nowIso: string
) {
  return Promise.all([
    supabase
      .from("appointments")
      .select(APPOINTMENT_SELECT)
      .eq("clinic_id", clinicId)
      .gte("start_at", todayStart)
      .lte("start_at", todayEnd)
      .not("status", "eq", "cancelled")
      .order("start_at")
      .limit(TODAY_APPOINTMENTS_LIMIT),
    supabase
      .from("appointments")
      .select(APPOINTMENT_SELECT)
      .eq("clinic_id", clinicId)
      .gte("start_at", nowIso)
      .in("status", [...UPCOMING_APPOINTMENT_STATUSES])
      .order("start_at")
      .limit(LIST_LIMIT),
  ]);
}

export async function fetchDashboardSecondaryQueries(
  supabase: SupabaseClient,
  clinicId: string,
  todayStart: string,
  studiesSince: string
) {
  return Promise.all([
    supabase
      .from("prescription_drafts")
      .select("id, created_at, patient_id, status, medications, patients(first_name, last_name, document_number)")
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
    supabase
      .from("medical_orders")
      .select("id, order_text, status, created_at, patient_id, patients(first_name, last_name)")
      .eq("clinic_id", clinicId)
      .eq("status", "draft")
      .order("created_at", { ascending: false })
      .limit(LIST_LIMIT),
  ]);
}

export function rowsOf<T>(data: T[] | null | undefined): T[] {
  return Array.isArray(data) ? data : [];
}

/** PostgREST may return embedded relations as a one-element array. */
export function normalizeLiveAppointment(row: LiveAppointment): LiveAppointment {
  const patients = unwrapJoin(row.patients);
  const professionals = unwrapJoin(row.professionals);
  const profiles = professionals ? unwrapJoin(professionals.profiles) : null;

  return {
    ...row,
    start_at: sanitizeIsoTimestamp(row.start_at),
    waiting_room_entered_at: row.waiting_room_entered_at
      ? sanitizeIsoTimestamp(row.waiting_room_entered_at)
      : (row.waiting_room_entered_at ?? null),
    patients,
    professionals: professionals ? { profiles } : null,
  };
}

export type CriticalPatientProfileRow = {
  patient_id: string;
  allergies?: string | null;
  regular_medication?: string | null;
  patients?:
    | { first_name: string; last_name: string; document_number: string }
    | { first_name: string; last_name: string; document_number: string }[]
    | null;
};

export async function fetchCriticalPatientProfiles(
  supabase: SupabaseClient,
  clinicId: string,
  allergyPatientIds: string[]
): Promise<{ data: CriticalPatientProfileRow[] }> {
  if (allergyPatientIds.length === 0) return { data: [] };

  try {
    const { data, error } = await supabase
      .from("patient_clinical_profiles")
      .select(
        "patient_id, allergies, regular_medication, patients(first_name, last_name, document_number)"
      )
      .eq("clinic_id", clinicId)
      .in("patient_id", allergyPatientIds);

    if (error) {
      console.error("[dashboard] critical patient profiles failed:", error.message);
      return { data: [] };
    }

    const rows = rowsOf(data as CriticalPatientProfileRow[] | null);
    return {
      data: rows.filter(
        (row) =>
          String(row.allergies ?? "").trim() !== "" ||
          String(row.regular_medication ?? "").trim() !== ""
      ),
    };
  } catch (err) {
    console.error("[dashboard] critical patient profiles threw:", err);
    return { data: [] };
  }
}

export function buildAllergiesByPatient(
  criticalRows: Array<{ patient_id: string; allergies?: string | null }>,
  waitingPatientIds: string[]
): Map<string, string | null> {
  const allergiesByPatient = new Map<string, string | null>();
  for (const row of criticalRows) {
    allergiesByPatient.set(row.patient_id, row.allergies ?? null);
  }
  for (const pid of waitingPatientIds) {
    if (!allergiesByPatient.has(pid)) allergiesByPatient.set(pid, null);
  }
  return allergiesByPatient;
}

export function buildAppointmentNotifications(
  todayAppointments: LiveAppointment[],
  overdue: ClinicalOperationsPayload["overdue"]
): ClinicalOperationsPayload["notifications"] {
  const notifications: ClinicalOperationsPayload["notifications"] = [];

  for (const appt of todayAppointments) {
    const name = appointmentPatientName(appt);
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
    const name = appointmentPatientName(appt);
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

  return notifications;
}

export function mapCriticalPatients(
  criticalRows: Array<{
    patient_id: string;
    allergies?: string | null;
    regular_medication?: string | null;
    patients?:
      | { first_name: string; last_name: string; document_number: string }
      | { first_name: string; last_name: string; document_number: string }[]
      | null;
  }>
): ClinicalOperationsPayload["criticalPatients"] {
  return criticalRows
    .map((row) => {
      const patient = unwrapJoin(row.patients ?? null);
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
}

export function mapDraftPrescriptions(
  rows: Array<{
    id: unknown;
    created_at: unknown;
    patient_id: unknown;
    status?: string;
    medications?: unknown;
    patients?:
      | { first_name: string; last_name: string; document_number: string }
      | { first_name: string; last_name: string; document_number: string }[]
      | null;
  }>
): ClinicalOperationsPayload["draftPrescriptions"] {
  return rows.map((row) => {
    const patient = unwrapJoin(row.patients ?? null);
    return {
      id: String(row.id),
      created_at: sanitizeIsoTimestamp(row.created_at),
      patient_id: String(row.patient_id),
      status: String(row.status ?? "draft"),
      medicationsSummary: summarizeMedications(row.medications),
      patients: patient,
    };
  });
}

export function mapPendingStudies(
  rows: Array<{
    id: unknown;
    file_name: unknown;
    created_at: unknown;
    patient_id: unknown;
    patients?: PatientNameRef | PatientNameRef[] | null;
  }>
): ClinicalOperationsPayload["pendingStudies"] {
  return rows.map((row) => {
    const patient = unwrapJoin(row.patients ?? null);
    return {
      id: String(row.id),
      file_name: String(row.file_name),
      created_at: sanitizeIsoTimestamp(row.created_at),
      patient_id: String(row.patient_id),
      patients: patient,
    };
  });
}

export function mapQueuedReminders(
  rows: Array<{
    id: unknown;
    created_at: unknown;
    channel: unknown;
    appointment_id: unknown;
    appointments?:
      | {
          start_at: string;
          patients?: PatientNameRef | PatientNameRef[] | null;
        }
      | {
          start_at: string;
          patients?: PatientNameRef | PatientNameRef[] | null;
        }[]
      | null;
  }>
) {
  return rows.map((row) => {
    const appt = unwrapJoin(row.appointments ?? null);
    const patient = unwrapJoin(appt?.patients ?? null);
    return {
      id: String(row.id),
      created_at: sanitizeIsoTimestamp(row.created_at),
      channel: String(row.channel),
      appointment_id: row.appointment_id ? String(row.appointment_id) : null,
      appointments: appt
        ? {
            start_at: sanitizeIsoTimestamp(appt.start_at),
            patients: patient,
          }
        : null,
    };
  });
}

export function mapPendingOrders(
  rows: Array<{
    id: unknown;
    order_text: unknown;
    status: unknown;
    created_at: unknown;
    patient_id: unknown;
    patients?: PatientNameRef | PatientNameRef[] | null;
  }>
) {
  return rows.map((row) => {
    const patient = unwrapJoin(row.patients ?? null);
    return {
      id: String(row.id),
      order_text: String(row.order_text),
      status: String(row.status),
      created_at: sanitizeIsoTimestamp(row.created_at),
      patient_id: String(row.patient_id),
      patients: patient,
    };
  });
}
