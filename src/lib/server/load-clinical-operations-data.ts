import type { SupabaseClient } from "@supabase/supabase-js";
import type { LiveAppointment } from "@/components/dashboard/consultorio-live-panel";
import type { ClinicalOperationsPayload } from "@/lib/utils/clinical-operations-types";

type Params = {
  clinicId: string;
  nowIso: string;
  todayQueue: LiveAppointment[];
  upcoming: LiveAppointment[];
};

export async function loadClinicalOperationsData(
  supabase: SupabaseClient,
  params: Params
): Promise<ClinicalOperationsPayload> {
  const { clinicId, nowIso, todayQueue, upcoming } = params;

  const patientIds = [
    ...new Set(todayQueue.map((a) => a.patient_id).filter((id): id is string => Boolean(id))),
  ];

  const [draftRx, pendingStudies, criticalRows] = await Promise.all([
    supabase
      .from("prescription_drafts")
      .select("id, created_at, patient_id, patients(first_name, last_name, document_number)")
      .eq("clinic_id", clinicId)
      .eq("status", "draft")
      .order("created_at", { ascending: false })
      .limit(8),
    supabase
      .from("patient_attachments")
      .select("id, file_name, created_at, patient_id, patients(first_name, last_name)")
      .eq("clinic_id", clinicId)
      .gte("created_at", new Date(Date.now() - 7 * 86400000).toISOString())
      .order("created_at", { ascending: false })
      .limit(8),
    patientIds.length > 0
      ? supabase
          .from("patient_clinical_profiles")
          .select("patient_id, allergies, regular_medication, patients(first_name, last_name, document_number)")
          .eq("clinic_id", clinicId)
          .in("patient_id", patientIds)
          .or("allergies.not.is.null,regular_medication.not.is.null")
      : Promise.resolve({ data: [] }),
  ]);

  const waitingDetailed = todayQueue.filter(
    (a) => a.status !== "attended" && a.status !== "cancelled" && a.status !== "no_show"
  ) as ClinicalOperationsPayload["waiting"];

  const overdue = todayQueue.filter(
    (a) =>
      a.start_at < nowIso &&
      a.status !== "attended" &&
      a.status !== "cancelled" &&
      a.status !== "no_show"
  ) as ClinicalOperationsPayload["overdue"];

  const notifications: ClinicalOperationsPayload["notifications"] = [];

  for (const appt of todayQueue) {
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
        ? `/historias/nueva?patient=${appt.patient_id}&appointment=${appt.id}`
        : "/agenda?view=day",
    });
  }

  const criticalPatients = (criticalRows.data ?? [])
    .map((row) => {
      const p = row.patients as
        | { first_name: string; last_name: string; document_number: string }
        | { first_name: string; last_name: string; document_number: string }[]
        | null;
      const patient = Array.isArray(p) ? p[0] ?? null : p;
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
      const p = row.patients as
        | { first_name: string; last_name: string; document_number: string }
        | { first_name: string; last_name: string; document_number: string }[]
        | null;
      const patient = Array.isArray(p) ? p[0] ?? null : p;
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
    const p = row.patients as
      | { first_name: string; last_name: string }
      | { first_name: string; last_name: string }[]
      | null;
    const patient = Array.isArray(p) ? p[0] ?? null : p;
    return {
      id: String(row.id),
      file_name: String(row.file_name),
      created_at: String(row.created_at),
      patient_id: String(row.patient_id),
      patients: patient,
    };
  });

  return {
    waiting: waitingDetailed,
    upcoming,
    overdue,
    draftPrescriptions,
    pendingStudies: pendingStudiesMapped,
    criticalPatients,
    notifications: notifications.slice(0, 10),
  };
}
