import type { SupabaseClient } from "@supabase/supabase-js";
import { buildLightweightPatientWarnings } from "@/lib/utils/clinical-assistant";
import type { ClinicJobRow, RunAiTaskJobPayload } from "@/lib/jobs/types";

export async function handleRunAiTaskJob(
  supabase: SupabaseClient,
  job: ClinicJobRow
): Promise<Record<string, unknown>> {
  const payload = job.payload as unknown as RunAiTaskJobPayload;

  const { data: patient } = await supabase
    .from("patients")
    .select(
      "id, first_name, last_name, birth_date, sex, insurance_provider, allergies, regular_medication, medical_history"
    )
    .eq("id", payload.patientId)
    .eq("clinic_id", job.clinic_id)
    .maybeSingle();

  if (!patient) {
    throw new Error("Paciente no encontrado");
  }

  const { data: records } = await supabase
    .from("clinical_records")
    .select("chief_complaint, diagnosis, evolution, created_at")
    .eq("patient_id", payload.patientId)
    .eq("clinic_id", job.clinic_id)
    .order("created_at", { ascending: false })
    .limit(5);

  const lastEvolution = records?.[0]?.evolution ?? "";
  const warnings = buildLightweightPatientWarnings({
    allergies: patient.allergies,
    regularMedication: patient.regular_medication,
    evolutionText: lastEvolution,
  });

  const activeProblems = (records ?? [])
    .map((r) => r.diagnosis?.trim())
    .filter((d): d is string => Boolean(d && d.length > 2))
    .slice(0, 8);

  if (payload.task === "clinical_summary") {
    return {
      task: payload.task,
      patientId: payload.patientId,
      patientName: `${patient.last_name}, ${patient.first_name}`,
      warnings,
      activeProblems,
      lastEvolutionPreview: lastEvolution.slice(0, 400),
      disclaimer: "Resumen rule-based — no reemplaza criterio médico.",
    };
  }

  return {
    task: payload.task,
    patientId: payload.patientId,
    warnings,
    soapDraft: {
      subjective: lastEvolution.slice(0, 500) || "Sin evolución reciente.",
      objective: patient.medical_history?.slice(0, 300) ?? "",
      assessment: records?.[0]?.diagnosis ?? "",
      plan: patient.regular_medication ?? "",
    },
    disclaimer: "Borrador SOAP rule-based — revisar antes de usar.",
  };
}
