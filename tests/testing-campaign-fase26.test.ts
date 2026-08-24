/**
 * Phase 26 — Testing campaign catalog tests.
 */
import { readFileSync } from "fs";
import { resolve } from "path";
import { describe, expect, it } from "vitest";

import {
  evaluateTestingCampaignPosture,
  PHASE26_FAILURE_LEDGER,
  PHASE26_REQUIRED_SUITES,
} from "@/core/compliance/testing-campaign";

const ROOT = process.cwd();

function read(rel: string): string {
  return readFileSync(resolve(ROOT, rel), "utf8");
}

describe("testing-campaign policy", () => {
  it("lists all required Phase 26 suites", () => {
    const ids = PHASE26_REQUIRED_SUITES.map((s) => s.id);
    expect(ids).toEqual(
      expect.arrayContaining([
        "lint",
        "typecheck",
        "unit",
        "integration_rls",
        "build",
        "rls_static",
        "tenant_isolation",
        "ai_sanitization",
        "authorization",
        "payment_webhook",
        "commercial_gate",
      ])
    );
  });

  it("forbids hiding failures and separates classifications", () => {
    const posture = evaluateTestingCampaignPosture();
    expect(posture.hideFailuresForbidden).toBe(true);
    expect(posture.separatesPreExistingFromIntroduced).toBe(true);
    expect(PHASE26_FAILURE_LEDGER.some((f) => f.classification === "pre_existing")).toBe(
      true
    );
    expect(
      PHASE26_FAILURE_LEDGER.some((f) => f.classification === "fixed_in_phase_26")
    ).toBe(true);
  });
});

describe("fase 26 remediations (static)", () => {
  it("migrations consistency expects 138", () => {
    const src = read("tests/migrations-consistency.test.ts");
    expect(src).toContain("138_commercial_essential_pro.sql");
    expect(src).toContain("138");
    expect(src).not.toMatch(/files\.length - 1\]\)\.toBe\("128_entitlement/);
  });

  it("csrf audit accepts Mercado Pago webhook HMAC", () => {
    const src = read("tests/csrf-audit.test.ts");
    expect(src).toContain("verifyMercadoPagoWebhookSignature");
  });

  it("TESTING-FASE-26.md documents pre-existing vs introduced", () => {
    const doc = read("docs/compliance/TESTING-FASE-26.md");
    expect(doc).toMatch(/preexistentes|pre_existing|Fallos preexistentes/i);
    expect(doc).toMatch(/introducidos|fixed_in_phase_26|corregidos/i);
    expect(doc).toMatch(/No se ocultan fallos|No se “esconden”|no se ocultan/i);
  });
});
