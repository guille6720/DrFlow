import { z } from "zod";

import { DEFAULT_COVERAGE_RULES, mergeCoverageRules } from "@/features/recetas/engine/default-coverage-rules";
import { COVERAGE_KINDS, type CoverageKind, type CoverageRuleConfig } from "@/features/recetas/engine/types";
import type { CoverageRuleRow } from "@/features/recetas/repositories/coverage-rules.repository";

export type CoverageRuleOverridesMap = Partial<Record<CoverageKind, Partial<CoverageRuleConfig>>>;

export const COVERAGE_REQUIRED_FIELD_OPTIONS = [
  { value: "insurance_number", label: "N° afiliado / beneficio" },
  { value: "insurance_plan", label: "Plan de cobertura" },
  { value: "diagnosis_cie10", label: "Diagnóstico CIE-10" },
  { value: "diagnosis_text", label: "Texto de diagnóstico" },
  { value: "patient_insurance", label: "Cobertura del paciente" },
] as const;

export const coverageRuleConfigSchema = z.object({
  requiredFields: z.array(z.string()).optional(),
  maxValidityDays: z.coerce.number().int().min(1).max(365).optional(),
  medicationSearch: z.enum(["pami_vademecum", "pharmacology", "manual"]).optional(),
  documentQr: z.boolean().optional(),
  infoMessages: z.array(z.string().max(500)).max(10).optional(),
});

export type CoverageRuleAdminForm = z.infer<typeof coverageRuleConfigSchema>;

export function getEffectiveCoverageRule(
  kind: CoverageKind,
  override: Partial<CoverageRuleConfig> | null | undefined
): CoverageRuleConfig {
  return mergeCoverageRules(kind, override ?? null);
}

export function buildCoverageRuleOverridesMap(rows: CoverageRuleRow[]): CoverageRuleOverridesMap {
  const map: CoverageRuleOverridesMap = {};
  for (const row of rows) {
    map[row.coverage_kind] = row.rules;
  }
  return map;
}

export function resolveCoverageRuleOverride(
  kind: CoverageKind | null | undefined,
  overrides?: CoverageRuleOverridesMap | null
): Partial<CoverageRuleConfig> | null {
  if (!kind || !isCoverageKind(kind)) return null;
  return overrides?.[kind] ?? null;
}

export function parseInfoMessagesText(text: string): string[] {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 10);
}

export function formatInfoMessagesText(messages: string[] | undefined): string {
  return (messages ?? []).join("\n");
}

export function buildCoverageRulePayload(input: CoverageRuleAdminForm): Partial<CoverageRuleConfig> {
  const payload: Partial<CoverageRuleConfig> = {};
  if (input.requiredFields != null) payload.requiredFields = input.requiredFields;
  if (input.maxValidityDays != null) payload.maxValidityDays = input.maxValidityDays;
  if (input.medicationSearch != null) payload.medicationSearch = input.medicationSearch;
  if (input.documentQr != null) payload.documentQr = input.documentQr;
  if (input.infoMessages != null) payload.infoMessages = input.infoMessages;
  return payload;
}

export function coverageKindLabel(kind: CoverageKind): string {
  const labels: Record<CoverageKind, string> = {
    PAMI: "PAMI",
    OBRAS_SOCIALES: "Obras sociales",
    PREPAGAS: "Prepagas",
    PARTICULAR: "Particular",
  };
  return labels[kind];
}

export function isCoverageKind(value: string): value is CoverageKind {
  return (COVERAGE_KINDS as readonly string[]).includes(value);
}

export function defaultRuleSummary(kind: CoverageKind): string {
  const rule = DEFAULT_COVERAGE_RULES[kind];
  return [
    `Campos obligatorios: ${rule.requiredFields.join(", ") || "ninguno"}`,
    `Vigencia máx.: ${rule.maxValidityDays ?? 30} días`,
    `Búsqueda: ${rule.medicationSearch}`,
    rule.documentQr ? "QR en documento: sí" : "QR en documento: no",
  ].join(" · ");
}
