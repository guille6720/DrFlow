import "server-only";

import { getActiveClinic, getActiveClinicId } from "@/core/auth/session.server";
import {
  evaluateRetentionPreservationSupport,
  isWithinClinicalRetentionPeriod,
  normalizeRetentionYears,
  patientHistoryRetentionUntil,
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
  /** ISO date when HC retention (from last entry) would elapse for the newest note clinic-wide. */
  historyRetentionUntilNewest: string | null;
  meetsDefaultMinimum: boolean;
  autoPurgeEnabled: false;
  retentionNotes: string[];
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
    { data: oldestRows },
    { data: newestRows },
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
      .order("created_at", { ascending: true })
      .limit(1),
    supabase
      .from("clinical_records")
      .select("created_at")
      .eq("clinic_id", clinicId)
      .order("created_at", { ascending: false })
      .limit(1),
  ]);

  const oldestRecordAt = oldestRows?.[0]?.created_at ?? null;
  const newestRecordAt = newestRows?.[0]?.created_at ?? null;
  // Approximate in-window count without scanning all rows: when newest is within retention,
  // treat all records as in-window (conservative ops metric). Exact purge uses dedicated jobs.
  const recordsWithinRetention =
    newestRecordAt && isWithinClinicalRetentionPeriod(newestRecordAt, retentionYears)
      ? (clinicalRecordCount ?? 0)
      : 0;
  const historyUntil = patientHistoryRetentionUntil(newestRecordAt, retentionYears);
  const preservation = evaluateRetentionPreservationSupport(retentionYears);

  return {
    data: {
      retentionYears,
      activePatients: activePatients ?? 0,
      inactivePatients: inactivePatients ?? 0,
      clinicalRecordCount: clinicalRecordCount ?? 0,
      recordsWithinRetention,
      oldestRecordAt,
      newestRecordAt,
      historyRetentionUntilNewest: historyUntil ? historyUntil.toISOString() : null,
      meetsDefaultMinimum: preservation.meetsMinimumAssumption,
      autoPurgeEnabled: false,
      retentionNotes: [
        ...preservation.notes,
        "recordsWithinRetention uses newest-entry heuristic (no full-table scan).",
      ],
    },
  };
}
