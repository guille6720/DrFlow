/**
 * Phase 22 — Legal draft templates must exist with attorney banner.
 */
import { existsSync, readFileSync } from "fs";
import { resolve } from "path";
import { describe, expect, it } from "vitest";

import {
  assertLegalDraftBannerPresent,
  evaluateLegalDocumentsPosture,
  LEGAL_DRAFT_ATTORNEY_BANNER,
  LEGAL_DRAFT_DOCUMENTS,
} from "@/core/compliance/legal-documents";

const ROOT = process.cwd();

function read(rel: string): string {
  return readFileSync(resolve(ROOT, rel), "utf8");
}

describe("legal-documents catalog", () => {
  it("lists the six required draft templates", () => {
    expect(LEGAL_DRAFT_DOCUMENTS).toHaveLength(6);
    expect(LEGAL_DRAFT_DOCUMENTS.map((d) => d.id)).toEqual([
      "terms_of_service",
      "privacy_policy",
      "data_processing_agreement",
      "subprocessors",
      "security_annex",
      "ai_processing_notice",
    ]);
    expect(LEGAL_DRAFT_DOCUMENTS.every((d) => d.isDraftRequiringAttorney)).toBe(true);
  });

  it("evaluateLegalDocumentsPosture forbids representing drafts as final advice", () => {
    const posture = evaluateLegalDocumentsPosture();
    expect(posture.representedAsFinalLegalAdvice).toBe(false);
    expect(posture.allRequireAttorneyReview).toBe(true);
    expect(posture.banner).toBe(LEGAL_DRAFT_ATTORNEY_BANNER);
    expect(posture.templateCount).toBe(6);
  });
});

describe("docs/legal draft files", () => {
  it("each draft exists and prominently includes the attorney banner", () => {
    for (const doc of LEGAL_DRAFT_DOCUMENTS) {
      expect(existsSync(resolve(ROOT, doc.file)), doc.file).toBe(true);
      const md = read(doc.file);
      expect(assertLegalDraftBannerPresent(md), doc.file).toBe(true);
      // Banner near the top (first ~500 chars after title)
      const head = md.slice(0, 400);
      expect(head).toContain(LEGAL_DRAFT_ATTORNEY_BANNER);
      expect(md.toLowerCase()).not.toMatch(
        /este documento es (un )?asesoramiento legal final|documento legal definitivo aprobado/i
      );
    }
  });

  it("README indexes drafts with the same banner", () => {
    const readme = read("docs/legal/README.md");
    expect(readme).toContain(LEGAL_DRAFT_ATTORNEY_BANNER);
    for (const doc of LEGAL_DRAFT_DOCUMENTS) {
      expect(readme).toContain(doc.file.replace("docs/legal/", ""));
    }
  });

  it("subprocessors draft points at technical register", () => {
    const md = read("docs/legal/SUBPROCESSORS-DRAFT.md");
    expect(md).toContain("subprocessors.ts");
    expect(md).toContain(LEGAL_DRAFT_ATTORNEY_BANNER);
  });

  it("terms draft marks cancellation B2B/B2C legal review", () => {
    const md = read("docs/legal/TERMS-OF-SERVICE-DRAFT.md");
    expect(md).toMatch(/REQUIERE REVISIÓN LEGAL SEGÚN TIPO DE CLIENTE B2B\/B2C/);
    expect(md).toContain("Mercado Pago");
  });
});
