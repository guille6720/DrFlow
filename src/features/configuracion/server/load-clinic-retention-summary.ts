import "server-only";

import { getActiveClinic, getActiveClinicId } from "@/core/auth/session.server";
import {
  isWithinClinicalRetentionPeriod,
  normalizeRetentionYears,
} from "@/core/compliance/data-retention-policy";
import { hasPermission } from "@/core/permissions/roles";
import { createClient } from "@/core/supabase/server";

export type ClinicRetentionSummary = {
  retentionYears: number;
  activePatients: number;
  inactivePatients: number;
  clinicalRecordCount: number;
  recordsWithinRetention: number;
  oldestRecordAt: string | null;
  newestRecordAt: string | null;
};

export async function loadClinicRetentionSummary(): Promise<{
  data?: ClinicRetentionSummary;
  error?: string;
}> {
  const clinicId = await getActiveClinicId();
  const { role, isSuperadmin } = await getActiveClinic();
  if (!clinicId || !hasPermission(role, "manageSettings", isSuperadmin)) {
    return { error: "Sin permisos." };
  }

  const supabase = await createClient();
  const { data: clinic } = await supabase
    .from("clinics")
    .select("clinical_record_retention_years")
    .eq("id", clinicId)
    .single();

  const retentionYears = normalizeRetentionYears(clinic?.clinical_record_retention_years);

  const [
    { count: activePatients },
    { count: inactivePatients },
    { count: clinicalRecordCount },
    { data: recordDates },
  ] = await Promise.all([
    supabase
      .from("patients")
      .select("id", { count: "exact", head: true })
      .eq("clinic_id", clinicId)
      .eq("is_active", true),
    supabase
      .from("patients")
      .select("id", { count: "exact", head: true })
      .eq("clinic_id", clinicId)
      .eq("is_active", false),
    supabase
      .from("clinical_records")
      .select("id", { count: "exact", head: true })
      .eq("clinic_id", clinicId),
    supabase
      .from("clinical_records")
      .select("created_at")
      .eq("clinic_id", clinicId)
      .order("created_at", { ascending: true }),
  ]);

  const dates = (recordDates ?? []).map((row) => row.created_at as string);
  const recordsWithinRetention = dates.filter((createdAt) =>
    isWithinClinicalRetentionPeriod(createdAt, retentionYears)
  ).length;

  return {
    data: {
      retentionYears,
      activePatients: activePatients ?? 0,
      inactivePatients: inactivePatients ?? 0,
      clinicalRecordCount: clinicalRecordCount ?? 0,
      recordsWithinRetention,
      oldestRecordAt: dates[0] ?? null,
      newestRecordAt: dates.at(-1) ?? null,
    },
  };
}
