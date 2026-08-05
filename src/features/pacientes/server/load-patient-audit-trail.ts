"use server";

import { getActiveClinic, getActiveClinicId, getSession } from "@/core/auth/session";
import { hasPermission } from "@/core/permissions/roles";
import {
  mergePatientAuditEvents,
  type PatientAuditEvent,
} from "@/core/security/audit-types";
import { createClient } from "@/core/supabase/server";
import { parseEntityId } from "@/core/validations/params";

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

  const idParsed = parseEntityId(patientId, "Paciente");
  if (!idParsed.ok) return { error: idParsed.error };

  const supabase = await createClient();

  const { data: patient } = await supabase
    .from("patients")
    .select("id")
    .eq("id", idParsed.data)
    .eq("clinic_id", clinicId)
    .maybeSingle();

  if (!patient) return { error: "Paciente no encontrado" };

  const patientFilter = `patient_id.eq.${idParsed.data},entity_id.eq.${idParsed.data}`;

  const [{ data: clinicLogs, error: logError }, { data: recordLogs, error: recordError }] =
    await Promise.all([
      supabase
        .from("audit_logs")
        .select(
          "id, action, module, what, entity_type, entity_id, created_at, ip_address, user_agent, old_values, new_values, profiles(full_name)"
        )
        .eq("clinic_id", clinicId)
        .or(patientFilter)
        .order("created_at", { ascending: false })
        .limit(AUDIT_LIMIT),
      supabase
        .from("clinical_record_audit")
        .select(
          "id, action, module, what, clinical_record_id, changed_at, ip_address, user_agent, old_values, new_values, profiles:changed_by(full_name)"
        )
        .eq("clinic_id", clinicId)
        .eq("patient_id", idParsed.data)
        .order("changed_at", { ascending: false })
        .limit(AUDIT_LIMIT),
    ]);

  if (logError) return { error: "No se pudo cargar la auditoría del consultorio" };
  if (recordError) return { error: "No se pudo cargar la auditoría de consultas" };

  return {
    data: mergePatientAuditEvents(clinicLogs ?? [], recordLogs ?? []),
  };
}
