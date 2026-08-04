import type { SupabaseClient } from "@supabase/supabase-js";
import { runClinicalAiOrchestrator } from "@/lib/utils/clinical-ai-orchestrator";
import { enhanceClinicalAiBodyIfConfigured } from "@/lib/utils/clinical-ai-llm-provider.server";
import type { ClinicJobRow, RunAiTaskJobPayload } from "@/core/jobs/types";
import type { PhysicianAssistContext } from "@/features/ia/types/physician-assist-types";

export async function handleRunAiTaskJob(
  supabase: SupabaseClient,
  job: ClinicJobRow
): Promise<Record<string, unknown>> {
  const payload = job.payload as unknown as RunAiTaskJobPayload;

  const { data: patient } = await supabase
    .from("patients")
    .select(
      "id, first_name, last_name, birth_date, sex, insurance_provider, insurance_plan, allergies, regular_medication, medical_history"
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

  const lastRecord = records?.[0];
  const patientName = `${patient.last_name}, ${patient.first_name}`;

  const assistContext: PhysicianAssistContext = {
    patientName,
    allergies: patient.allergies,
    regularMedication: patient.regular_medication,
    medicalHistory: patient.medical_history,
    lastEvolution: lastRecord?.evolution ?? null,
    lastDiagnosis: lastRecord?.diagnosis ?? null,
    evolutionText: lastRecord?.evolution ?? undefined,
    diagnosis: lastRecord?.diagnosis ?? null,
    chiefComplaint: lastRecord?.chief_complaint ?? null,
    insurance: patient.insurance_provider ?? undefined,
    insurancePlan: patient.insurance_plan ?? undefined,
    activeProblems: (records ?? [])
      .map((r) => r.diagnosis?.trim())
      .filter((d): d is string => Boolean(d && d.length > 2))
      .slice(0, 8),
  };

  const taskMap = {
    clinical_summary: "clinical_summary" as const,
    soap_draft: "soap_draft" as const,
    proactive_followup: "proactive_followup" as const,
    close_encounter: "close_encounter" as const,
  };

  const orchestratorTask = taskMap[payload.task] ?? "clinical_summary";

  let result = runClinicalAiOrchestrator({
    task: orchestratorTask,
    patientId: payload.patientId,
    patientName,
    lastConsultAt: lastRecord?.created_at ?? null,
    assistContext,
    labSourceText: payload.labSourceText,
  });

  if (payload.enhanceWithLlm) {
    const enhanced = await enhanceClinicalAiBodyIfConfigured({
      agentId: result.agentId,
      body: result.body,
      contextSummary: patientName,
    });
    result = { ...result, body: enhanced.body, engine: enhanced.engine };
  }

  return {
    task: payload.task,
    patientId: payload.patientId,
    patientName,
    agentId: result.agentId,
    engine: result.engine,
    title: result.title,
    body: result.body,
    itemCount: result.items.length,
    disclaimer: result.disclaimer,
  };
}
