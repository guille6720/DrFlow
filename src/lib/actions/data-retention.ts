"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getActiveClinic, getActiveClinicId, getSession, logAudit } from "@/core/auth/session.server";
import {
  buildPatientDeactivationEvaluation,
  isWithinClinicalRetentionPeriod,
  normalizeRetentionYears,
  RETENTION_YEARS_MAX,
  RETENTION_YEARS_MIN,
} from "@/core/compliance/data-retention-policy";
import { hasPermission } from "@/core/permissions/roles";
import { createClient } from "@/core/supabase/server";
import { parseEntityId } from "@/core/validations/params";

const updateRetentionSchema = z.object({
  clinical_record_retention_years: z.coerce
    .number()
    .int()
    .min(RETENTION_YEARS_MIN)
    .max(RETENTION_YEARS_MAX),
});

export async function updateClinicRetentionYears(years: number) {
  const clinicId = await getActiveClinicId();
  const { role, isSuperadmin } = await getActiveClinic();
  const user = await getSession();

  if (!clinicId || !user || !hasPermission(role, "manageSettings", isSuperadmin)) {
    return { error: "Sin permisos para actualizar la política de retención." };
  }

  const parsed = updateRetentionSchema.safeParse({ clinical_record_retention_years: years });
  if (!parsed.success) {
    return {
      error: `Los años de retención deben estar entre ${RETENTION_YEARS_MIN} y ${RETENTION_YEARS_MAX}.`,
    };
  }

  const supabase = await createClient();
  const { data: before } = await supabase
    .from("clinics")
    .select("clinical_record_retention_years")
    .eq("id", clinicId)
    .single();

  const { error } = await supabase
    .from("clinics")
    .update({ clinical_record_retention_years: parsed.data.clinical_record_retention_years })
    .eq("id", clinicId);

  if (error) return { error: "No se pudo guardar la política de retención." };

  await logAudit({
    clinicId,
    module: "compliance",
    what: "Actualizó política de retención de historias clínicas",
    entityType: "clinic",
    entityId: clinicId,
    action: "update",
    oldValues: { clinical_record_retention_years: before?.clinical_record_retention_years ?? null },
    newValues: { clinical_record_retention_years: parsed.data.clinical_record_retention_years },
  });

  revalidatePath("/configuracion");
  return { success: true, retentionYears: parsed.data.clinical_record_retention_years };
}

export async function loadPatientDeactivationPolicy(patientId: string) {
  const parsed = parseEntityId(patientId, "Paciente");
  if (!parsed.ok) return { error: parsed.error };

  const clinicId = await getActiveClinicId();
  const { role, isSuperadmin } = await getActiveClinic();
  if (!clinicId || !hasPermission(role, "managePatients", isSuperadmin)) {
    return { error: "Sin permisos." };
  }

  const supabase = await createClient();
  const [{ data: clinic }, { data: records }] = await Promise.all([
    supabase
      .from("clinics")
      .select("clinical_record_retention_years")
      .eq("id", clinicId)
      .single(),
    supabase
      .from("clinical_records")
      .select("created_at")
      .eq("clinic_id", clinicId)
      .eq("patient_id", parsed.data)
      .order("created_at", { ascending: false }),
  ]);

  const retentionYears = normalizeRetentionYears(clinic?.clinical_record_retention_years);
  const dates = (records ?? []).map((row) => row.created_at as string);
  const recordsWithinRetention = dates.filter((createdAt) =>
    isWithinClinicalRetentionPeriod(createdAt, retentionYears)
  ).length;

  return {
    data: buildPatientDeactivationEvaluation({
      retentionYears,
      clinicalRecordCount: dates.length,
      recordsWithinRetention,
      latestRecordAt: dates[0] ?? null,
    }),
  };
}
