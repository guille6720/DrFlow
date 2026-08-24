import { readFileSync } from "fs";
import { resolve } from "path";
import { describe, expect, it } from "vitest";

import {
  evaluatePrescriptionCompliancePosture,
  FORBIDDEN_OFFICIAL_PRESCRIPTION_CLAIMS,
  isRefepsSandboxId,
  PRESCRIPTION_INTERNAL_CAPABILITIES,
  PRESCRIPTION_REGULATORY_REQUIREMENTS,
  REFEPS_SANDBOX_DISCLAIMER,
  resolveRefepsDocumentLanguage,
} from "@/core/compliance/prescription-compliance";

import { resolvePrescriptionDocumentQr } from "@/features/recetas/utils/prescription-document-coverage";

import {
  ARGENTINA_PRESCRIPTION_DISCLAIMER,
  REFEPS_STATUS_LABELS,
} from "@/types/prescription";

const ROOT = process.cwd();

function read(rel: string): string {
  return readFileSync(resolve(ROOT, rel), "utf8");
}

describe("prescription-compliance policy module", () => {
  it("declares DrFlow is not homologated", () => {
    const posture = evaluatePrescriptionCompliancePosture();
    expect(posture.drflowHomologated).toBe(false);
    expect(posture.disclaimer).toContain("no es homologación REFEPS");
  });

  it("separates internal capabilities from blocked official claims", () => {
    const allowed = PRESCRIPTION_INTERNAL_CAPABILITIES.filter((c) => c.allowed).map((c) => c.id);
    const blocked = PRESCRIPTION_INTERNAL_CAPABILITIES.filter((c) => !c.allowed).map((c) => c.id);
    expect(allowed).toEqual(
      expect.arrayContaining(["draft", "issue_local", "print_pdf", "share", "void", "refeps_adapter"])
    );
    expect(blocked).toEqual(
      expect.arrayContaining(["legal_digital_signature", "claim_official_eprescription"])
    );
  });

  it("lists regulatory items requiring legal review", () => {
    const ids = PRESCRIPTION_REGULATORY_REQUIREMENTS.map((r) => r.id);
    expect(ids).toEqual(
      expect.arrayContaining([
        "refeps_homologation",
        "software_prescriber_registration",
        "digital_signature",
        "aaip",
      ])
    );
    expect(
      PRESCRIPTION_REGULATORY_REQUIREMENTS.some((r) => r.status === "requires_legal_review")
    ).toBe(true);
  });

  it("detects sandbox REFEPS ids", () => {
    expect(isRefepsSandboxId("REFEPS-SBX-ABCDEF")).toBe(true);
    expect(isRefepsSandboxId("REFEPS-REAL-123")).toBe(false);
    expect(isRefepsSandboxId(null)).toBe(false);
  });

  it("uses sandbox disclaimer language for SBX identifiers", () => {
    const lang = resolveRefepsDocumentLanguage({
      refepsStatus: "submitted",
      refepsId: "REFEPS-SBX-TEST123",
    });
    expect(lang?.qrTitle).toMatch(/sandbox/i);
    expect(lang?.qrHint).toBe(REFEPS_SANDBOX_DISCLAIMER);
    expect(lang?.qrHint).toMatch(/No constituye aprobación gubernamental/i);
  });
});

describe("prescription document QR language (Phase 17)", () => {
  it("does not claim official REFEPS registration for sandbox ids", () => {
    const qr = resolvePrescriptionDocumentQr({
      refepsStatus: "submitted",
      refepsId: "REFEPS-SBX-TEST123",
      prescriptionNumber: "RX-1",
      patientDocumentNumber: "30123456",
      issuedAt: "2026-08-11T12:00:00.000Z",
      coverageKind: "PAMI",
    });
    expect(qr.showQr).toBe(true);
    expect(qr.qrTitle).toMatch(/sandbox/i);
    expect(qr.qrHint).not.toMatch(/aprobación gubernamental garantizada/i);
    expect(qr.qrHint).toMatch(/prueba/i);
  });
});

describe("Phase 17 wiring (static)", () => {
  it("disclaimer constant is non-empty and local/borrador", () => {
    expect(ARGENTINA_PRESCRIPTION_DISCLAIMER).toMatch(/borrador/i);
    expect(ARGENTINA_PRESCRIPTION_DISCLAIMER).toMatch(/no es homologación REFEPS/i);
  });

  it("UI status labels avoid implying MSN registration", () => {
    expect(REFEPS_STATUS_LABELS.submitted).toMatch(/adapter/i);
    expect(REFEPS_STATUS_LABELS.submitted.toLowerCase()).not.toContain("homologad");
    expect(REFEPS_STATUS_LABELS.local).toMatch(/sin REFEPS/i);
  });

  it("wizard requires local/borrador disclaimer acceptance", () => {
    const wizard = read("src/features/recetas/components/recetas/prescription-wizard.tsx");
    expect(wizard).toMatch(/receta local \/ borrador/i);
    expect(wizard).toMatch(/no constituye homologación REFEPS/i);
  });

  it("PDF/print embed ARGENTINA_PRESCRIPTION_DISCLAIMER", () => {
    expect(read("src/features/recetas/utils/export-prescription-pdf.ts")).toContain(
      "ARGENTINA_PRESCRIPTION_DISCLAIMER"
    );
    expect(read("src/features/recetas/utils/print-prescription-document.ts")).toContain(
      "ARGENTINA_PRESCRIPTION_DISCLAIMER"
    );
  });

  it("issue audit uses local draft language", () => {
    const src = read("src/features/recetas/actions/prescriptions.ts");
    expect(src).toContain("Emitió receta local");
    expect(src).toContain("legal_validity");
    expect(src).not.toMatch(/Emitió receta electrónica"/);
  });

  it("landing FAQ does not claim official e-prescription", () => {
    const landing = read("src/core/components/landing/drflow-home-landing.tsx");
    expect(landing).toMatch(/recetas locales/i);
    expect(landing).toMatch(/homologación MSN/i);
    for (const claim of FORBIDDEN_OFFICIAL_PRESCRIPTION_CLAIMS) {
      expect(landing.toLowerCase()).not.toContain(claim);
    }
  });

  it("compliance doc exists with required sections", () => {
    const doc = read("docs/compliance/RECETA-ELECTRONICA-ARGENTINA.md");
    expect(doc).toMatch(/Funcionalidad interna/i);
    expect(doc).toMatch(/Requisitos técnicos/i);
    expect(doc).toMatch(/Requisitos regulatorios/i);
    expect(doc).toMatch(/ReNaPDiS/i);
    expect(doc).toMatch(/REQUIERE VERIFICACIÓN/i);
    expect(doc).toMatch(/No constituye asesoramiento legal/i);
  });

  it("print/PDF titles say local/borrador not official e-prescription", () => {
    expect(read("src/features/recetas/utils/print-prescription-document.ts")).toContain(
      "RECETA LOCAL / BORRADOR"
    );
    expect(read("src/features/recetas/utils/export-prescription-pdf.ts")).toContain(
      "RECETA LOCAL / BORRADOR"
    );
    expect(read("src/features/recetas/components/recetas/prescription-document-view.tsx")).toContain(
      "RECETA LOCAL / BORRADOR"
    );
  });

  it("sandbox submit does not invent government approval in provider", () => {
    const provider = read("src/core/refeps/provider.ts");
    expect(provider).toContain("REFEPS-SBX-");
    expect(provider).toContain("submitViaSandbox");
    expect(provider.toLowerCase()).not.toContain("aprobación gubernamental concedida");
  });
});
