import type { SupabaseClient } from "@supabase/supabase-js";

import { recordAiAuditEvent } from "@/core/compliance/ai-audit";
import { addonFeaturesForClinicalAiTask } from "@/core/entitlements/clinical-ai-features";
import { canUseFeatureAsSystem } from "@/core/entitlements/entitlements.server";
import { FEATURES } from "@/core/entitlements/features";
import { consumeAddonUsageAsSystem } from "@/core/entitlements/metered.server";
import type { ClinicJobRow, RunAiTaskJobPayload } from "@/core/jobs/types";

import type { PhysicianAssistContext } from "@/features/ia/types/physician-assist-types";

import { ClinicalAiSanitizationError } from "@/lib/ai/external-clinical-ai-gateway.server";
import { buildPatientKnownIdentifiers } from "@/lib/ai/patient-ai-identifiers.server";
import { sanitizeClinicalAIInput } from "@/lib/ai/sanitize-clinical-ai-input";
import { enhanceClinicalAiBodyIfConfigured } from "@/lib/utils/clinical-ai-llm-provider.server";
import { runClinicalAiOrchestrator } from "@/lib/utils/clinical-ai-orchestrator";

export async function handleRunAiTaskJob(
  supabase: SupabaseClient,
  job: ClinicJobRow
): Promise<Record<string, unknown>> {
  const payload = job.payload as unknown as RunAiTaskJobPayload;

  if (
    !(await canUseFeatureAsSystem({
      clinicId: job.clinic_id,
      featureKey: FEATURES.AI,
    }))
  ) {
    throw new Error("La IA no está incluida en el plan del consultorio.");
  }

  for (const extraFeature of addonFeaturesForClinicalAiTask(payload.task)) {
    if (
      !(await canUseFeatureAsSystem({
        clinicId: job.clinic_id,
        featureKey: extraFeature,
      }))
    ) {
      throw new Error("Esta función de IA no está incluida en el plan del consultorio.");
    }
  }

  const quota = await consumeAddonUsageAsSystem({
    clinicId: job.clinic_id,
    featureKey: FEATURES.AI_MONTHLY_REQUESTS,
  });
  if (!quota.ok) throw new Error(quota.error);

  const { data: patient } = await supabase
    .from("patients")
    .select(
      "id, first_name, last_name, birth_date, sex, document_number, phone, email, insurance_provider, insurance_plan, allergies, regular_medication, medical_history"
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
    const knownIdentifiers = buildPatientKnownIdentifiers({
      firstName: patient.first_name,
      lastName: patient.last_name,
      documentNumber: patient.document_number,
      phone: patient.phone,
      email: patient.email,
    });

    const labText = payload.labSourceText?.trim();
    if (labText) {
      const labSanitized = sanitizeClinicalAIInput(labText, { knownIdentifiers });
      if (labSanitized.blocked) {
        await recordAiAuditEvent({
          clinicId: job.clinic_id,
          userId: job.created_by ?? undefined,
          patientId: payload.patientId,
          feature: "clinical_ai_job",
          provider: "unknown",
          task: payload.task,
          success: false,
          sanitizationStatus: "blocked",
          errorCode: "sanitization_blocked",
        });
        throw new ClinicalAiSanitizationError(
          labSanitized.blockReason ?? "Texto de laboratorio no pudo anonimizarse."
        );
      }
    }

    const bodySanitized = sanitizeClinicalAIInput(result.body, { knownIdentifiers });
    if (bodySanitized.blocked) {
      await recordAiAuditEvent({
        clinicId: job.clinic_id,
        userId: job.created_by ?? undefined,
        patientId: payload.patientId,
        feature: "clinical_ai_job",
        provider: "unknown",
        task: payload.task,
        success: false,
        sanitizationStatus: "blocked",
        errorCode: "sanitization_blocked",
      });
      throw new ClinicalAiSanitizationError(
        bodySanitized.blockReason ?? "Borrador clínico no pudo anonimizarse."
      );
    }

    try {
      const enhanced = await enhanceClinicalAiBodyIfConfigured({
        agentId: result.agentId,
        body: bodySanitized.sanitized,
        contextSummary: "Paciente: PACIENTE_A",
        knownIdentifiers,
        strictSanitization: true,
      });
      result = { ...result, body: enhanced.body, engine: enhanced.engine };

      await recordAiAuditEvent({
        clinicId: job.clinic_id,
        userId: job.created_by ?? undefined,
        patientId: payload.patientId,
        feature: "clinical_ai_job",
        provider: enhanced.engine === "llm_enhanced" ? "openai_compatible" : "rule_based",
        task: payload.task,
        success: enhanced.engine === "llm_enhanced",
        sanitizationStatus:
          bodySanitized.status === "partial" ? "partial" : "ok",
        redactionCount: bodySanitized.redactionCount,
      });
    } catch (err) {
      if (err instanceof ClinicalAiSanitizationError) {
        await recordAiAuditEvent({
          clinicId: job.clinic_id,
          userId: job.created_by ?? undefined,
          patientId: payload.patientId,
          feature: "clinical_ai_job",
          provider: "unknown",
          task: payload.task,
          success: false,
          sanitizationStatus: "blocked",
          errorCode: "sanitization_blocked",
        });
      }
      throw err;
    }
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
