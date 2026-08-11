import { readFileSync } from "fs";
import { resolve } from "path";
import { describe, expect, it } from "vitest";

import { DEFAULT_COVERAGE_RULES } from "@/features/recetas/engine/default-coverage-rules";
import { buildPrescriptionDocumentData } from "@/features/recetas/utils/build-prescription-document-data";
import {
  buildCoverageRuleOverridesMap,
  buildCoverageRulePayload,
  coverageRuleConfigSchema,
  getEffectiveCoverageRule,
  parseInfoMessagesText,
} from "@/features/recetas/utils/coverage-rules-admin";
import { shouldShowPrescriptionDocumentQr } from "@/features/recetas/utils/prescription-document-coverage";

describe("coverage rules admin Etapa 5", () => {
  it("merges clinic overrides over defaults", () => {
    const effective = getEffectiveCoverageRule("PAMI", {
      documentQr: false,
      maxValidityDays: 60,
    });

    expect(effective.documentQr).toBe(false);
    expect(effective.maxValidityDays).toBe(60);
    expect(effective.requiredFields).toEqual(DEFAULT_COVERAGE_RULES.PAMI.requiredFields);
  });

  it("builds overrides map from repository rows", () => {
    const map = buildCoverageRuleOverridesMap([
      {
        coverage_kind: "PAMI",
        rules: { documentQr: false },
      },
    ]);

    expect(map.PAMI?.documentQr).toBe(false);
  });

  it("respects clinic override for document QR", () => {
    expect(shouldShowPrescriptionDocumentQr("PAMI")).toBe(true);
    expect(shouldShowPrescriptionDocumentQr("PAMI", { documentQr: false })).toBe(false);
    expect(shouldShowPrescriptionDocumentQr("PAMI", { documentQr: true })).toBe(true);
  });

  it("applies clinic override when building document data", () => {
    const data = buildPrescriptionDocumentData(
      {
        id: "rx-1",
        created_at: "2026-08-11T12:00:00.000Z",
        issued_at: "2026-08-11T12:05:00.000Z",
        status: "issued",
        prescription_number: "RX-1",
        prescription_type: "ambulatoria",
        validity_days: 30,
        diagnosis_cie10: "I10",
        diagnosis_text: "HTA",
        patient_insurance: "PAMI",
        coverage_kind: "PAMI",
        insurance_number: "123",
        medications: [],
        professional_id: "pro-1",
      },
      {
        first_name: "Ana",
        last_name: "López",
        document_number: "30111222",
      },
      { name: "Clínica" },
      [{ id: "pro-1", display_name: "Dr. Test" }],
      { coverageRuleOverrides: { PAMI: { documentQr: false } } }
    );

    expect(data.showQr).toBe(false);
    expect(data.qrPayload).toBeNull();
  });

  it("validates admin form payload", () => {
    const parsed = coverageRuleConfigSchema.safeParse({
      requiredFields: ["insurance_number"],
      maxValidityDays: 45,
      medicationSearch: "pami_vademecum",
      documentQr: true,
      infoMessages: parseInfoMessagesText("Línea 1\n\nLínea 2"),
    });

    expect(parsed.success).toBe(true);
    if (!parsed.success) return;

    const payload = buildCoverageRulePayload(parsed.data);
    expect(payload.maxValidityDays).toBe(45);
    expect(payload.infoMessages).toEqual(["Línea 1", "Línea 2"]);
  });

  it("prod SQL scripts restrict coverage_rules writes to can_manage_clinic", () => {
    const prodEngine = readFileSync(
      resolve(process.cwd(), "supabase/scripts/prod-fix-prescription-engine.sql"),
      "utf8"
    );
    const prodRls = readFileSync(
      resolve(process.cwd(), "supabase/scripts/prod-fix-coverage-rules-rls.sql"),
      "utf8"
    );

    for (const sql of [prodEngine, prodRls]) {
      expect(sql).toMatch(/coverage_rules_insert[\s\S]*can_manage_clinic/);
      expect(sql).not.toMatch(/coverage_rules_insert[\s\S]*can_write_clinical/);
    }
  });
});
