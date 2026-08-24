import { readFileSync } from "fs";
import { resolve } from "path";
import { describe, expect, it } from "vitest";

import {
  assertClinicalResearchFlagDefaultsOff,
  CLINICAL_RESEARCH_DISABLED_USER_MESSAGE,
  CLINICAL_RESEARCH_PRIVACY_LEGAL_REVIEW,
  CLINICAL_RESEARCH_PROTOCOLS_FLAG,
  CLINICAL_RESEARCH_SURFACES,
  detectsClinicalResearchIntent,
  evaluateClinicalResearchAiPosture,
} from "@/core/compliance/clinical-research-ai";

import { getFeatureFlagDefinition } from "@/features/flags/lib/registry";

import { parseGeminiClinicStatsQuery } from "@/lib/ai/gemini-clinic-stats";

const ROOT = process.cwd();

function read(rel: string): string {
  return readFileSync(resolve(ROOT, rel), "utf8");
}

describe("clinical-research-ai policy module", () => {
  it("keeps research flag default OFF", () => {
    expect(assertClinicalResearchFlagDefaultsOff()).toBe(true);
    expect(getFeatureFlagDefinition(CLINICAL_RESEARCH_PROTOCOLS_FLAG).defaultEnabled).toBe(false);
  });

  it("lists gated surfaces and review checklist", () => {
    expect(CLINICAL_RESEARCH_SURFACES.map((s) => s.id)).toEqual(
      expect.arrayContaining([
        "consulta_protocols_panel",
        "gemini_protocol_matching",
        "gemini_protocol_catalog",
      ])
    );
    expect(CLINICAL_RESEARCH_PRIVACY_LEGAL_REVIEW.length).toBeGreaterThanOrEqual(5);
    expect(
      CLINICAL_RESEARCH_PRIVACY_LEGAL_REVIEW.some((i) => i.status === "required_before_activation")
    ).toBe(true);
  });

  it("detects recruitment / protocol intents", () => {
    expect(detectsClinicalResearchIntent("Candidatos para MARITIME-CV")).toBe(true);
    expect(detectsClinicalResearchIntent("Criterios del estudio PRESTO")).toBe(true);
    expect(detectsClinicalResearchIntent("¿Cuántos pacientes con hipertensión hay?")).toBe(false);
  });

  it("evaluateClinicalResearchAiPosture forbids auto-enable", () => {
    const posture = evaluateClinicalResearchAiPosture();
    expect(posture.defaultEnabled).toBe(false);
    expect(posture.productionAutoEnable).toBe(false);
    expect(posture.featureFlag).toBe("clinical_research_protocols");
  });
});

describe("stats query research gate", () => {
  it("attaches protocol when research allowed", () => {
    const q = parseGeminiClinicStatsQuery("Candidatos para MARITIME-CV", {
      allowClinicalResearchProtocols: true,
    });
    expect(q?.protocol).toBeTruthy();
    expect(q?.condition?.id.startsWith("protocol:")).toBe(true);
  });

  it("blocks protocol recruitment when research disallowed", () => {
    const q = parseGeminiClinicStatsQuery("Candidatos para MARITIME-CV", {
      allowClinicalResearchProtocols: false,
    });
    expect(q).toBeNull();
  });

  it("still allows non-research clinic stats when gated", () => {
    const q = parseGeminiClinicStatsQuery("Diagnósticos más frecuentes este mes", {
      allowClinicalResearchProtocols: false,
    });
    expect(q).not.toBeNull();
    expect(q?.protocol).toBeNull();
    expect(q?.wantTopDiagnoses).toBe(true);
  });
});

describe("Phase 18 wiring (static)", () => {
  it("registry documents legal review before activation", () => {
    const src = read("src/features/flags/lib/registry.ts");
    expect(src).toContain("clinical_research_protocols");
    expect(src).toMatch(/defaultEnabled:\s*false/);
    expect(src).toMatch(/revisión legal/i);
  });

  it("runGeminiClinicalChat gates research intent server-side", () => {
    const src = read("src/lib/ai/run-gemini-clinical.server.ts");
    expect(src).toContain("CLINICAL_RESEARCH_PROTOCOLS_FLAG");
    expect(src).toContain("detectsClinicalResearchIntent");
    expect(src).toContain("allowClinicalResearchProtocols");
    expect(src).toContain("CLINICAL_RESEARCH_DISABLED_USER_MESSAGE");
  });

  it("consulta workspace hides protocolos button when flag off", () => {
    const src = read("src/features/historias/components/consultas/drapp-consulta-workspace.tsx");
    expect(src).toContain("researchProtocolsEnabled");
    expect(src).toContain("CLINICAL_RESEARCH_PROTOCOLS_FLAG");
  });

  it("protocols panel respects feature flag", () => {
    const src = read("src/features/historias/components/consultas/drapp-protocols-quick-panel.tsx");
    expect(src).toContain('useFeatureFlag("clinical_research_protocols")');
    expect(src).toMatch(/desactivados/i);
  });

  it("disabled message is actionable and non-approving", () => {
    expect(CLINICAL_RESEARCH_DISABLED_USER_MESSAGE).toMatch(/desactivados/i);
    expect(CLINICAL_RESEARCH_DISABLED_USER_MESSAGE).toMatch(/revisión legal/i);
  });

  it("compliance doc exists", () => {
    const doc = read("docs/compliance/CLINICAL-RESEARCH-AI-FASE-18.md");
    expect(doc).toMatch(/PHASE 18|Fase 18/i);
    expect(doc).toMatch(/revisión legal/i);
    expect(doc).toMatch(/default.*OFF|defaultEnabled/i);
  });
});
