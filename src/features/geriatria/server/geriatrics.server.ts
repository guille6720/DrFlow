import "server-only";

import { getActiveClinicId } from "@/core/auth/session.server";
import { PRODUCTS } from "@/core/products/products";
import { requireProduct } from "@/core/products/products.server";
import { asStagingSchemaClient } from "@/core/products/staging-schema-client";
import { createClient } from "@/core/supabase/server";

export type GeriatricsDashboardKpis = {
  activeResidents: number;
  totalBeds: number;
  occupiedBeds: number;
  freeBeds: number;
  occupancyPercent: number;
  pendingMedications: number;
  overdueMedications: number;
  pendingControls: number;
  overdueControls: number;
  recentIncidents: number;
  residentsWithAlerts: number;
  scheduledTransfers: number;
  recentAdmissions: number;
};

export async function requireGeriatricsClinic(): Promise<{ clinicId: string }> {
  const clinicId = await getActiveClinicId();
  if (!clinicId) {
    throw new Error("CLINIC_REQUIRED");
  }
  await requireProduct(clinicId, PRODUCTS.GERIATRICS);
  return { clinicId };
}

export async function loadGeriatricsDashboardKpis(
  clinicId: string
): Promise<GeriatricsDashboardKpis> {
  const supabase = asStagingSchemaClient(await createClient());
  const now = new Date();
  const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const [
    residents,
    beds,
    pendingMeds,
    overdueMeds,
    incidents,
    transfers,
    recentAdmissions,
  ] = await Promise.all([
    supabase
      .from("geriatrics_residents")
      .select("id, clinical_alerts, status", { count: "exact" })
      .eq("clinic_id", clinicId)
      .eq("status", "activo"),
    supabase
      .from("geriatrics_beds")
      .select("id, status", { count: "exact" })
      .eq("clinic_id", clinicId)
      .eq("is_active", true),
    supabase
      .from("geriatrics_medication_administrations")
      .select("id", { count: "exact", head: true })
      .eq("clinic_id", clinicId)
      .eq("status", "pendiente"),
    supabase
      .from("geriatrics_medication_administrations")
      .select("id", { count: "exact", head: true })
      .eq("clinic_id", clinicId)
      .eq("status", "pendiente")
      .lt("scheduled_at", now.toISOString()),
    supabase
      .from("geriatrics_incidents")
      .select("id", { count: "exact", head: true })
      .eq("clinic_id", clinicId)
      .gte("occurred_at", weekAgo),
    supabase
      .from("geriatrics_transfers")
      .select("id", { count: "exact", head: true })
      .eq("clinic_id", clinicId)
      .eq("status", "programado"),
    supabase
      .from("geriatrics_residents")
      .select("id", { count: "exact", head: true })
      .eq("clinic_id", clinicId)
      .gte("created_at", dayAgo),
  ]);

  const bedRows = (beds.data ?? []) as Array<{ id: string; status: string }>;
  const totalBeds = beds.count ?? bedRows.length;
  const occupiedBeds = bedRows.filter((b: { status: string }) => b.status === "ocupada").length;
  const freeBeds = bedRows.filter((b: { status: string }) => b.status === "libre").length;
  const residentRows = (residents.data ?? []) as Array<{
    id: string;
    clinical_alerts: string | null;
    status: string;
  }>;
  const activeResidents = residents.count ?? residentRows.length;
  const residentsWithAlerts = residentRows.filter(
    (r: { clinical_alerts: string | null }) =>
      r.clinical_alerts && String(r.clinical_alerts).trim().length > 0
  ).length;

  return {
    activeResidents,
    totalBeds,
    occupiedBeds,
    freeBeds,
    occupancyPercent: totalBeds > 0 ? Math.round((occupiedBeds / totalBeds) * 100) : 0,
    pendingMedications: pendingMeds.count ?? 0,
    overdueMedications: overdueMeds.count ?? 0,
    pendingControls: 0,
    overdueControls: 0,
    recentIncidents: incidents.count ?? 0,
    residentsWithAlerts,
    scheduledTransfers: transfers.count ?? 0,
    recentAdmissions: recentAdmissions.count ?? 0,
  };
}

/** Deterministic resident summary for 24/48/72h windows (no AI). */
export async function loadResidentRecentSummary(
  clinicId: string,
  residentId: string,
  hours: 24 | 48 | 72
) {
  const supabase = asStagingSchemaClient(await createClient());
  const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();

  const [evolutions, nursing, meds, incidents, nutrition, transfers] = await Promise.all([
    supabase
      .from("geriatrics_evolutions")
      .select("id, specialty, content, recorded_at")
      .eq("clinic_id", clinicId)
      .eq("resident_id", residentId)
      .gte("recorded_at", since)
      .order("recorded_at", { ascending: false }),
    supabase
      .from("geriatrics_nursing_notes")
      .select("id, shift_key, recorded_at, temperature, blood_pressure_systolic, observations")
      .eq("clinic_id", clinicId)
      .eq("resident_id", residentId)
      .gte("recorded_at", since)
      .order("recorded_at", { ascending: false }),
    supabase
      .from("geriatrics_medication_administrations")
      .select("id, status, scheduled_at, administered_at, observations")
      .eq("clinic_id", clinicId)
      .eq("resident_id", residentId)
      .gte("created_at", since)
      .order("created_at", { ascending: false }),
    supabase
      .from("geriatrics_incidents")
      .select("id, incident_type, occurred_at, description")
      .eq("clinic_id", clinicId)
      .eq("resident_id", residentId)
      .gte("occurred_at", since)
      .order("occurred_at", { ascending: false }),
    supabase
      .from("geriatrics_nutrition_logs")
      .select("id, recorded_at, intake_percent, hydration_ml, weight_kg")
      .eq("clinic_id", clinicId)
      .eq("resident_id", residentId)
      .gte("recorded_at", since)
      .order("recorded_at", { ascending: false }),
    supabase
      .from("geriatrics_transfers")
      .select("id, transfer_type, status, scheduled_at, destination")
      .eq("clinic_id", clinicId)
      .eq("resident_id", residentId)
      .gte("created_at", since)
      .order("created_at", { ascending: false }),
  ]);

  return {
    hours,
    since,
    evolutions: evolutions.data ?? [],
    nursing: nursing.data ?? [],
    medications: meds.data ?? [],
    incidents: incidents.data ?? [],
    nutrition: nutrition.data ?? [],
    transfers: transfers.data ?? [],
  };
}
