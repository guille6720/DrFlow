"use server";

import { createClient } from "@/lib/supabase/server";
import { getActiveClinicId, getSession, getActiveClinic } from "@/lib/auth/session";
import { hasPermission } from "@/lib/permissions/roles";
import {
  mergePatientAuditEvents,
  type PatientAuditEvent,
} from "@/lib/security/audit-types";

const AUDIT_LIMIT = 120;

export async function loadPatientAuditTrail(
  patientId: string
): Promise<{ data?: PatientAuditEvent[]; error?: string }> {
  const user = await getSession();
  if (!user) return { error: "Sin sesión" };

  const clinicId = await getActiveClinicId();
  if (!clinicId) return { error: "Sin clínica activa" };

  const { role, isSuperadmin } = await getActiveClinic();
  if (!hasPermission(role, "viewClinicalRecords", isSuperadmin)) {
    return { error: "Sin permisos para ver auditoría clínica" };
  }

  const supabase = await createClient();

  const { data: patient } = await supabase
    .from("patients")
    .select("id")
    .eq("id", patientId)
    .eq("clinic_id", clinicId)
    .maybeSingle();

  if (!patient) return { error: "Paciente no encontrado" };

  const { data: recordIds } = await supabase
    .from("clinical_records")
    .select("id")
    .eq("patient_id", patientId)
    .eq("clinic_id", clinicId);

  const recordIdList = (recordIds ?? []).map((r) => r.id);

  const entityFilter = [`entity_id.eq.${patientId}`, `patient_id.eq.${patientId}`];
  if (recordIdList.length > 0) {
    entityFilter.push(`entity_id.in.(${recordIdList.join(",")})`);
  }

  const [{ data: clinicLogs, error: logError }, { data: recordLogs, error: recordError }] =
    await Promise.all([
      supabase
        .from("audit_logs")
        .select(
          "id, action, entity_type, entity_id, created_at, ip_address, user_agent, old_values, new_values, profiles(full_name)"
        )
        .eq("clinic_id", clinicId)
        .or(entityFilter.join(","))
        .order("created_at", { ascending: false })
        .limit(AUDIT_LIMIT),
      recordIdList.length > 0
        ? supabase
            .from("clinical_record_audit")
            .select(
              "id, action, clinical_record_id, changed_at, ip_address, user_agent, old_values, new_values, profiles:changed_by(full_name)"
            )
            .eq("clinic_id", clinicId)
            .in("clinical_record_id", recordIdList)
            .order("changed_at", { ascending: false })
            .limit(AUDIT_LIMIT)
        : Promise.resolve({ data: [], error: null }),
    ]);

  if (logError) return { error: "No se pudo cargar la auditoría del consultorio" };
  if (recordError) return { error: "No se pudo cargar la auditoría de consultas" };

  return {
    data: mergePatientAuditEvents(clinicLogs ?? [], recordLogs ?? []),
  };
}
