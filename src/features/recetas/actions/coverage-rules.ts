"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireClinicPermission } from "@/core/actions/clinic-guard";
import { revalidateClinicCoverageRulesCache } from "@/core/cache/revalidate-clinic-cache";
import { recordAudit } from "@/core/security/audit-service";
import { requireClinicalIssueAccess } from "@/core/services/clinical-access.service";
import { createClient } from "@/core/supabase/server";
import { firstZodIssue } from "@/core/validations/params";

import { COVERAGE_KINDS, type CoverageKind } from "@/features/recetas/engine/types";
import {
  type CoverageRuleRow,
  deleteCoverageRuleForKind,
  loadActiveCoverageRulesForClinic,
  loadCoverageRuleForKind,
  upsertCoverageRule,
} from "@/features/recetas/repositories/coverage-rules.repository";
import {
  buildCoverageRuleOverridesMap,
  buildCoverageRulePayload,
  coverageRuleConfigSchema,
  type CoverageRuleOverridesMap,
  isCoverageKind,
  parseInfoMessagesText,
} from "@/features/recetas/utils/coverage-rules-admin";

function revalidateCoverageRuleViews(clinicId: string) {
  revalidateClinicCoverageRulesCache(clinicId);
  revalidatePath("/configuracion");
}

export async function getClinicCoverageRules(): Promise<{
  data?: CoverageRuleRow[];
  error?: string;
}> {
  const [access, supabase] = await Promise.all([
    requireClinicPermission("manageSettings"),
    createClient(),
  ]);
  if (!access.ok) return { error: access.error };
  const result = await loadActiveCoverageRulesForClinic(supabase, access.clinicId);
  if (!result.ok) return { error: result.error };
  return { data: result.data };
}

/** For prescribers — wizard validation aligned with clinic overrides. */
export async function getPrescriptionCoverageRuleOverrides(): Promise<{
  data?: CoverageRuleOverridesMap;
  error?: string;
}> {
  const [access, supabase] = await Promise.all([requireClinicalIssueAccess(), createClient()]);
  if (!access.ok) return { error: access.error };
  const result = await loadActiveCoverageRulesForClinic(supabase, access.data.clinicId);
  if (!result.ok) return { error: result.error };
  return { data: buildCoverageRuleOverridesMap(result.data) };
}

export async function getClinicCoverageRule(
  coverageKind: CoverageKind
): Promise<{ data?: CoverageRuleRow | null; error?: string }> {
  const [access, supabase] = await Promise.all([
    requireClinicPermission("manageSettings"),
    createClient(),
  ]);
  if (!access.ok) return { error: access.error };

  const result = await loadCoverageRuleForKind(supabase, access.clinicId, coverageKind);
  if (!result.ok) return { error: result.error };
  return { data: result.data };
}

const saveSchema = z.object({
  coverage_kind: z.enum(COVERAGE_KINDS),
  required_fields: z.array(z.string()).optional(),
  max_validity_days: z.coerce.number().int().min(1).max(365).optional(),
  medication_search: z.enum(["medication_catalog", "pami_vademecum", "pharmacology", "manual"]).optional(),
  document_qr: z.coerce.boolean().optional(),
  info_messages_text: z.string().max(5000).optional(),
});

export async function saveClinicCoverageRule(formData: FormData) {
  const [access, supabase] = await Promise.all([
    requireClinicPermission("manageSettings"),
    createClient(),
  ]);
  if (!access.ok) return { error: access.error };

  const kindRaw = String(formData.get("coverage_kind") ?? "");
  if (!isCoverageKind(kindRaw)) return { error: "Cobertura inválida." };

  const requiredFieldsRaw = formData.getAll("required_fields").map(String);
  const parsed = saveSchema.safeParse({
    coverage_kind: kindRaw,
    required_fields: requiredFieldsRaw.length > 0 ? requiredFieldsRaw : undefined,
    max_validity_days: formData.get("max_validity_days"),
    medication_search: String(formData.get("medication_search") ?? "") || undefined,
    document_qr: formData.get("document_qr") === "on" || formData.get("document_qr") === "true",
    info_messages_text: String(formData.get("info_messages_text") ?? ""),
  });

  if (!parsed.success) return { error: firstZodIssue(parsed.error) };

  const configParsed = coverageRuleConfigSchema.safeParse({
    requiredFields: parsed.data.required_fields,
    maxValidityDays: parsed.data.max_validity_days,
    medicationSearch: parsed.data.medication_search,
    documentQr: parsed.data.document_qr,
    infoMessages: parseInfoMessagesText(parsed.data.info_messages_text ?? ""),
  });

  if (!configParsed.success) return { error: firstZodIssue(configParsed.error) };

  const payload = buildCoverageRulePayload(configParsed.data);
  const result = await upsertCoverageRule(
    supabase,
    access.clinicId,
    parsed.data.coverage_kind,
    payload,
    true
  );

  if (!result.ok) return { error: result.error };

  await recordAudit({
    clinicId: access.clinicId,
    module: "prescriptions",
    entityType: "coverage_rule",
    entityId: result.data.id ?? parsed.data.coverage_kind,
    action: "update",
    what: `Actualizó reglas de receta (${parsed.data.coverage_kind})`,
    metadata: payload,
  });

  revalidateCoverageRuleViews(access.clinicId);
  return { data: result.data };
}

export async function resetClinicCoverageRule(coverageKind: CoverageKind) {
  const [access, supabase] = await Promise.all([
    requireClinicPermission("manageSettings"),
    createClient(),
  ]);
  if (!access.ok) return { error: access.error };
  const result = await deleteCoverageRuleForKind(supabase, access.clinicId, coverageKind);
  if (!result.ok) return { error: result.error };

  await recordAudit({
    clinicId: access.clinicId,
    module: "prescriptions",
    entityType: "coverage_rule",
    entityId: coverageKind,
    action: "delete",
    what: `Restauró defaults de receta (${coverageKind})`,
  });

  revalidateCoverageRuleViews(access.clinicId);
  return { data: result.data };
}
