"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireClinicPermission } from "@/lib/actions/clinic-guard";
import { calculatePackYears } from "@/lib/utils/clinical-indicators";
import {
  mergeNotesWithChartExtras,
  parsePatientChartExtras,
  stripChartJsonFromNotes,
} from "@/lib/utils/patient-chart-notes";
import type { PatientChartExtras } from "@/lib/utils/patient-chart-types";

export type ClinicalIndicatorsInput = {
  weightKg?: number | null;
  heightCm?: number | null;
  creatinineMgDl?: number | null;
  cigarettesPerDay?: number | null;
  smokingYears?: number | null;
  cardiovascularRisk?: "low" | "moderate" | "high" | null;
};

function upsertCreatinineLab(
  labs: PatientChartExtras["labs"],
  value: number | null | undefined
): PatientChartExtras["labs"] {
  const list = [...(labs ?? [])];
  const idx = list.findIndex((l) => l.name.toLowerCase().includes("creatinina"));
  if (value == null || !Number.isFinite(value) || value <= 0) {
    if (idx >= 0) list.splice(idx, 1);
    return list.length ? list : undefined;
  }
  const entry = {
    name: "Creatinina",
    value: String(value),
    unit: "mg/dL",
    status: "unknown" as const,
  };
  if (idx >= 0) list[idx] = { ...list[idx], ...entry };
  else list.push(entry);
  return list;
}

export async function savePatientClinicalIndicators(
  patientId: string,
  input: ClinicalIndicatorsInput
): Promise<{ error?: string }> {
  const access = await requireClinicPermission("editClinicalRecords");
  if (!access.ok) return { error: access.error };
  const { clinicId } = access;

  const supabase = await createClient();
  const { data: patient, error: fetchError } = await supabase
    .from("patients")
    .select("notes")
    .eq("id", patientId)
    .eq("clinic_id", clinicId)
    .maybeSingle();

  if (fetchError) return { error: fetchError.message };
  if (!patient) return { error: "Paciente no encontrado" };

  const current = parsePatientChartExtras(patient.notes);
  const packYears =
    input.cigarettesPerDay != null && input.smokingYears != null
      ? calculatePackYears(input.cigarettesPerDay, input.smokingYears)
      : current.pack_years ?? null;

  const merged: PatientChartExtras = {
    ...current,
    weight_kg: input.weightKg ?? null,
    height_cm: input.heightCm ?? null,
    cigarettes_per_day: input.cigarettesPerDay ?? null,
    smoking_years: input.smokingYears ?? null,
    pack_years: packYears,
    cardiovascular_risk: input.cardiovascularRisk ?? current.cardiovascular_risk ?? null,
    labs: upsertCreatinineLab(current.labs, input.creatinineMgDl),
  };

  const notes = mergeNotesWithChartExtras(stripChartJsonFromNotes(patient.notes), merged);
  const { error } = await supabase
    .from("patients")
    .update({ notes })
    .eq("id", patientId)
    .eq("clinic_id", clinicId);

  if (error) return { error: error.message };

  revalidatePath(`/pacientes/${patientId}`);
  revalidatePath(`/pacientes/${patientId}?tab=evoluciones`);
  return {};
}
