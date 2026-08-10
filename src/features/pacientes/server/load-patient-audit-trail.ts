"use server";

import { getActiveClinic, getActiveClinicId, getSession } from "@/core/auth/session.server";
import { hasPermission } from "@/core/permissions/roles";
import {
  mergePatientAuditEvents,
  type PatientAuditEvent,
} from "@/core/security/audit-types";
import {
  encodeDescCursor,
  parseDescCursor,
  PATIENT_AUDIT_PAGE_SIZE,
} from "@/core/supabase/pagination";
import { createClient } from "@/core/supabase/server";
import { parseEntityId } from "@/core/validations/params";

const AUDIT_FETCH_BATCH = PATIENT_AUDIT_PAGE_SIZE * 3;

export type PatientAuditTrailResult = {
  data?: PatientAuditEvent[];
  error?: string;
  nextCursor?: string | null;
  hasMore?: boolean;
};

function isBeforeCursor(event: PatientAuditEvent, cursor: { sortValue: string; id: string }): boolean {
  const eventTime = new Date(event.occurredAt).getTime();
  const cursorTime = new Date(cursor.sortValue).getTime();
  if (eventTime < cursorTime) return true;
  if (eventTime > cursorTime) return false;
  return event.id < cursor.id;
}

export async function loadPatientAuditTrail(
  patientId: string,
  options?: { cursor?: string; limit?: number }
): Promise<PatientAuditTrailResult> {
  const user = await getSession();
  if (!user) return { error: "Sin sesión" };

  const clinicId = await getActiveClinicId();
  if (!clinicId) return { error: "Sin clínica activa" };

  const { role, isSuperadmin } = await getActiveClinic();
  if (!hasPermission(role, "viewClinicalRecords", isSuperadmin)) {
    return { error: "Sin permisos para ver auditoría clínica" };
  }

  const idParsed = parseEntityId(patientId, "Paciente");
  if (!idParsed.ok) return { error: idParsed.error };

  const supabase = await createClient();
  const limit = options?.limit ?? PATIENT_AUDIT_PAGE_SIZE;
  const cursor = parseDescCursor(options?.cursor);

  const { data: patient } = await supabase
    .from("patients")
    .select("id")
    .eq("id", idParsed.data)
    .eq("clinic_id", clinicId)
    .maybeSingle();

  if (!patient) return { error: "Paciente no encontrado" };

  const patientFilter = `patient_id.eq.${idParsed.data},entity_id.eq.${idParsed.data}`;

  let clinicQuery = supabase
    .from("audit_logs")
    .select(
      "id, action, module, what, entity_type, entity_id, created_at, ip_address, user_agent, old_values, new_values, profiles(full_name)"
    )
    .eq("clinic_id", clinicId)
    .or(patientFilter)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(AUDIT_FETCH_BATCH);

  let recordQuery = supabase
    .from("clinical_record_audit")
    .select(
      "id, action, module, what, clinical_record_id, changed_at, ip_address, user_agent, old_values, new_values, profiles:changed_by(full_name)"
    )
    .eq("clinic_id", clinicId)
    .eq("patient_id", idParsed.data)
    .order("changed_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(AUDIT_FETCH_BATCH);

  if (cursor) {
    clinicQuery = clinicQuery.lt("created_at", cursor.sortValue);
    recordQuery = recordQuery.lt("changed_at", cursor.sortValue);
  }

  const [{ data: clinicLogs, error: logError }, { data: recordLogs, error: recordError }] =
    await Promise.all([clinicQuery, recordQuery]);

  if (logError) return { error: "No se pudo cargar la auditoría del consultorio" };
  if (recordError) return { error: "No se pudo cargar la auditoría de consultas" };

  let merged = mergePatientAuditEvents(clinicLogs ?? [], recordLogs ?? []);
  if (cursor) {
    merged = merged.filter((event) => isBeforeCursor(event, cursor));
  }

  const page = merged.slice(0, limit);
  const last = page.at(-1);
  const hasMore =
    merged.length > limit ||
    (clinicLogs?.length ?? 0) >= AUDIT_FETCH_BATCH ||
    (recordLogs?.length ?? 0) >= AUDIT_FETCH_BATCH;

  return {
    data: page,
    nextCursor: hasMore && last ? encodeDescCursor(last.occurredAt, last.id) : null,
    hasMore,
  };
}
