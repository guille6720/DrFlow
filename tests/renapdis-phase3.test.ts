import { readFileSync } from "fs";
import { resolve } from "path";
import { afterEach, describe, expect, it } from "vitest";

import { sanitizeMonitoringPayload } from "@/core/observability/sanitize-monitoring-payload";
import { validateProfessionalWithRefeps } from "@/core/refeps/professional-validation";
import { isRefepsApiConfigured } from "@/core/refeps/provider";
import {
  getRefepsDependencyStatus,
  isRefepsForcedOutage,
  nationalSubmitBlockedByOutage,
} from "@/core/renapdis/external-outage";
import {
  getRenapdisOperationalReadiness,
  OPS_ALERT_THRESHOLDS,
  READINESS_STATES,
} from "@/core/renapdis/operational-readiness";

describe("ReNaPDiS Phase 3 — operational readiness", () => {
  it("never auto-claims homologation and uses allowed states", () => {
    const items = getRenapdisOperationalReadiness();
    expect(items.length).toBeGreaterThan(5);
    for (const item of items) {
      expect(READINESS_STATES).toContain(item.state);
      expect(item.label.toLowerCase()).not.toContain("homologat");
    }
    expect(items.some((i) => i.id === "backup_pitr" && i.state === "blocked_external")).toBe(
      true
    );
  });

  it("defines alert thresholds without hardcoded personal contacts", () => {
    expect(OPS_ALERT_THRESHOLDS.length).toBeGreaterThan(3);
    for (const t of OPS_ALERT_THRESHOLDS) {
      expect(t.notifyEnvVar).toBe("OPS_ALERT_WEBHOOK_URL");
      expect(t.description).not.toMatch(/@gmail\.com|whatsapp|\+\d{8,}/i);
    }
  });
});

describe("ReNaPDiS Phase 3 — monitoring sanitization", () => {
  it("redacts secrets and clinical-ish keys", () => {
    const clean = sanitizeMonitoringPayload({
      path: "/api/health",
      token: "super-secret",
      diagnosis: "should not ship",
      nested: { api_key: "abc", latencyMs: 12 },
      authorization: "Bearer eyJhbGciOi.fake",
    });
    expect(clean.token).toBe("[redacted]");
    expect(clean.diagnosis).toBe("[redacted]");
    expect((clean.nested as Record<string, unknown>).api_key).toBe("[redacted]");
    expect((clean.nested as Record<string, unknown>).latencyMs).toBe(12);
    expect(clean.authorization).toBe("[redacted]");
  });
});

describe("ReNaPDiS Phase 3 — external outage", () => {
  const original = { ...process.env };

  afterEach(() => {
    process.env = { ...original };
  });

  it("detects REFEPS_FORCE_OUTAGE and blocks national submit semantics", () => {
    process.env.REFEPS_FORCE_OUTAGE = "1";
    expect(isRefepsForcedOutage()).toBe(true);
    const status = getRefepsDependencyStatus();
    expect(status.available).toBe(false);
    const blocked = nationalSubmitBlockedByOutage(status);
    expect(blocked?.ok).toBe(false);
    expect(blocked?.nationalRxStatus).toBe("failed");
    expect(blocked?.legalValidity).toBe("none");
  });

  it("REFEPS validation reports unavailable on forced outage (never validates silently)", async () => {
    const result = await validateProfessionalWithRefeps(
      { documentNumber: "90000001", licenseNumber: "MN1", profession: null, jurisdiction: null },
      { env: { REFEPS_FORCE_OUTAGE: "true", REFEPS_VALIDATION_MODE: "sandbox" } }
    );
    expect(isRefepsApiConfigured()).toBe(false);
    expect(result.valid).toBe(false);
    expect(result.status).toBe("unavailable");
    expect(result.reason).toBe("forced_outage");
  });
});

describe("ReNaPDiS Phase 3 — fiscalization seed isolation", () => {
  it("seed SQL is synthetic-only and marks fiscalization clinic", () => {
    const sql = readFileSync(
      resolve(process.cwd(), "supabase/seeds/fiscalization/01_clinic_and_patients.sql"),
      "utf8"
    );
    expect(sql).toMatch(/is_fiscalization/);
    expect(sql).toMatch(/Fiscalización \(TEST\)/);
    expect(sql).toMatch(/90000001/);
    expect(sql).not.toMatch(/guille67c@gmail\.com/i);
  });

  it("migration 142 is additive fiscalization marker", () => {
    const sql = readFileSync(
      resolve(process.cwd(), "supabase/migrations/142_renapdis_phase3_fiscalization_marker.sql"),
      "utf8"
    );
    expect(sql).toMatch(/ADD COLUMN IF NOT EXISTS is_fiscalization/);
    expect(sql).toMatch(/NOT NULL DEFAULT false/);
  });
});

describe("ReNaPDiS Phase 3 — service role exposure static checks", () => {
  it("readiness UI page does not embed service role literals", () => {
    const page = readFileSync(
      resolve(
        process.cwd(),
        "src/app/(dashboard)/superadmin/renapdis-readiness/page.tsx"
      ),
      "utf8"
    );
    expect(page).not.toMatch(/SERVICE_ROLE|eyJhbGciOi/);
    expect(page).not.toMatch(/\bHomologat(?:ed|ion|ado)\b/i);
    expect(page).toMatch(/Never auto-claims ministry approval/);
  });

  it("health module never serializes connection strings into public helpers", () => {
    const src = readFileSync(
      resolve(process.cwd(), "src/core/observability/health.ts"),
      "utf8"
    );
    expect(src).not.toMatch(/DATABASE_URL|SERVICE_ROLE_KEY/);
    expect(src).toMatch(/sanitizeMonitoringPayload/);
  });
});
