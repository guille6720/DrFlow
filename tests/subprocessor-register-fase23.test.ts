/**
 * Phase 23 — Subprocessor register completeness & honesty tests.
 */
import { existsSync, readFileSync } from "fs";
import { resolve } from "path";
import { describe, expect, it } from "vitest";

import {
  assertSubprocessorEntryComplete,
  evaluateSubprocessorRegisterPosture,
  getSubprocessorById,
  listSubprocessors,
  SUBPROCESSOR_REGISTER,
  SUBPROCESSOR_REQUIERE_VERIFICACION,
  SUBPROCESSORS_NOT_DISCOVERED,
} from "@/core/compliance/subprocessors";

const ROOT = process.cwd();

function read(rel: string): string {
  return readFileSync(resolve(ROOT, rel), "utf8");
}

describe("subprocessor register", () => {
  it("includes expected discovered providers and excludes invented analytics", () => {
    const ids = SUBPROCESSOR_REGISTER.map((e) => e.id);
    expect(ids).toEqual(
      expect.arrayContaining([
        "supabase",
        "vercel",
        "google_vertex",
        "mercadopago",
        "email_smtp",
        "sentry",
        "daily_co",
        "jitsi",
        "meta_whatsapp",
        "byok_ai",
        "refeps",
      ])
    );
    expect(ids).not.toContain("posthog");
    expect(ids).not.toContain("google_analytics");
    expect(SUBPROCESSORS_NOT_DISCOVERED.some((n) => n.id === "product_analytics")).toBe(true);
  });

  it("every entry has required Phase 23 fields + code evidence", () => {
    for (const entry of listSubprocessors()) {
      expect(assertSubprocessorEntryComplete(entry), entry.id).toBe(true);
      expect(["yes", "no", "unknown"]).toContain(entry.healthData);
      expect(entry.codeEvidence.length).toBeGreaterThan(0);
    }
  });

  it("keeps unknown DPA/jurisdiction/privacy as REQUIERE VERIFICACIÓN where applicable", () => {
    const supabase = getSubprocessorById("supabase")!;
    expect(supabase.dpaStatus).toBe(SUBPROCESSOR_REQUIERE_VERIFICACION);
    expect(supabase.processingJurisdiction).toContain(SUBPROCESSOR_REQUIERE_VERIFICACION);

    const email = getSubprocessorById("email_smtp")!;
    expect(email.privacyDocStatus).toBe(SUBPROCESSOR_REQUIERE_VERIFICACION);

    const mp = getSubprocessorById("mercadopago")!;
    expect(mp.healthData).toBe("no");
    expect(mp.processingJurisdiction).toBe("Argentina");
  });

  it("evaluateSubprocessorRegisterPosture is complete and honest", () => {
    const posture = evaluateSubprocessorRegisterPosture();
    expect(posture.allEntriesComplete).toBe(true);
    expect(posture.analyticsNotInvented).toBe(true);
    expect(posture.unknownMustStayRequiereVerificacion).toBe(true);
    expect(posture.entryCount).toBe(SUBPROCESSOR_REGISTER.length);
    expect(posture.verificationPendingCount).toBeGreaterThan(0);
  });
});

describe("fase 23 wiring (static)", () => {
  it("codeEvidence paths exist for core providers", () => {
    const checks: { id: string; path: string }[] = [
      { id: "supabase", path: "src/core/supabase/admin.ts" },
      { id: "mercadopago", path: "src/core/billing/mercadopago.ts" },
      { id: "email_smtp", path: "src/lib/services/transactional-email.ts" },
      { id: "sentry", path: "src/core/observability/sentry.server.ts" },
      { id: "jitsi", path: "src/core/telemedicine/provider.ts" },
      { id: "meta_whatsapp", path: "src/core/whatsapp/provider.ts" },
    ];
    for (const c of checks) {
      expect(existsSync(resolve(ROOT, c.path)), c.path).toBe(true);
      const entry = getSubprocessorById(c.id)!;
      expect(entry.codeEvidence.some((e) => e.includes(c.path) || e === c.path)).toBe(true);
    }
  });

  it("legal draft lists register ids and REQUIERE VERIFICACIÓN", () => {
    const draft = read("docs/legal/SUBPROCESSORS-DRAFT.md");
    expect(draft).toContain("BORRADOR — REQUIERE REVISIÓN DE ABOGADO");
    expect(draft).toContain("REQUIERE VERIFICACIÓN");
    expect(draft).toContain("subprocessors.ts");
    expect(draft).toMatch(/No hay integración|no se lista/i);
    for (const id of ["supabase", "vercel", "mercadopago", "sentry", "refeps"]) {
      expect(draft).toContain(id);
    }
  });

  it("no product analytics package in dependencies", () => {
    const pkg = read("package.json");
    expect(pkg).not.toMatch(/"posthog|"@amplitude|"mixpanel-browser|"react-ga/);
  });
});
