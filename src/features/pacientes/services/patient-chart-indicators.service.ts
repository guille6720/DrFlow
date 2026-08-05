import type { DbClient } from "@/core/repositories/types";
import type { ServiceResult } from "@/core/services/types";
import { fromRepo, serviceErr } from "@/core/services/types";

import {
  findPatientClinicalProfile,
  upsertPatientClinicalProfileRow,
} from "@/features/pacientes/repositories/patient-clinical-profile.repository";
import { patientExists } from "@/features/pacientes/repositories/patients.repository";
import type { PatientChartExtras } from "@/features/pacientes/utils/patient-chart-model-types";
import {
  mergeNotesWithChartExtras,
  parsePatientChartExtras,
  stripChartJsonFromNotes,
} from "@/features/pacientes/utils/patient-chart-notes";

import { calculatePackYears } from "@/lib/utils/clinical-indicators";

export type ClinicalIndicatorsInput = {
  weightKg?: number | null;
  heightCm?: number | null;
  creatinineMgDl?: number | null;
  cigarettesPerDay?: number | null;
  smokingYears?: number | null;
  cardiovascularRisk?: "low" | "moderate" | "high" | null;
};

export function upsertCreatinineLab(
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

export function mergeClinicalIndicators(
  currentNotes: string | null | undefined,
  input: ClinicalIndicatorsInput
): string {
  const current = parsePatientChartExtras(currentNotes);
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

  return mergeNotesWithChartExtras(stripChartJsonFromNotes(currentNotes), merged) ?? "";
}

export async function saveClinicalIndicators(
  db: DbClient,
  patientId: string,
  clinicId: string,
  input: ClinicalIndicatorsInput
): Promise<ServiceResult<void>> {
  const exists = await patientExists(db, patientId, clinicId);
  if (!exists) return serviceErr("Paciente no encontrado");

  const profile = await findPatientClinicalProfile(db, patientId, clinicId);
  const notes = mergeClinicalIndicators(profile?.notes, input);

  return fromRepo(await upsertPatientClinicalProfileRow(db, patientId, clinicId, { notes }));
}
