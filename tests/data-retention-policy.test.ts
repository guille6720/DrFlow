import { readFileSync } from "fs";
import { resolve } from "path";
import { describe, expect, it } from "vitest";

import {
  buildPatientDeactivationEvaluation,
  CLINICAL_RETENTION_POLICY,
  clinicalRecordRetentionUntil,
  DATA_RETENTION_CATEGORIES,
  evaluateRetentionPreservationSupport,
  isPatientHistoryWithinRetention,
  isWithinClinicalRetentionPeriod,
  latestClinicalEntryAt,
  normalizeRetentionYears,
  patientHistoryRetentionUntil,
  retentionCategoryYearsLabel,
} from "@/core/compliance/data-retention-policy";
import { CLINICAL_RECORD_RETENTION_YEARS } from "@/core/legal/documents";

describe("099_data_retention_policy migration", () => {
  const sql = readFileSync(
    resolve(process.cwd(), "supabase/migrations/099_data_retention_policy.sql"),
    "utf8"
  );

  it("adds clinic retention years and patient deactivation columns", () => {
    expect(sql).toMatch(/clinical_record_retention_years INT/);
    expect(sql).toMatch(/deactivated_at TIMESTAMPTZ/);
    expect(sql).toMatch(/deactivated_by UUID/);
  });

  it("defaults to 10 years and constrains 5–30", () => {
    expect(sql).toMatch(/DEFAULT 10/);
    expect(sql).toMatch(/clinical_record_retention_years >= 5/);
    expect(sql).toMatch(/clinical_record_retention_years <= 30/);
  });
});

describe("CLINICAL_RETENTION_POLICY (Phase 8 central config)", () => {
  it("uses 10-year default from legal documents — not scattered literals", () => {
    expect(CLINICAL_RECORD_RETENTION_YEARS).toBe(10);
    expect(CLINICAL_RETENTION_POLICY.defaultYears).toBe(10);
    expect(CLINICAL_RETENTION_POLICY.minYears).toBe(5);
    expect(CLINICAL_RETENTION_POLICY.maxYears).toBe(30);
  });

  it("anchors patient HC retention to last clinical entry", () => {
    expect(CLINICAL_RETENTION_POLICY.patientHistoryAnchor).toBe("last_clinical_entry");
  });

  it("does not enable automatic clinical purge", () => {
    expect(CLINICAL_RETENTION_POLICY.autoPurgeEnabled).toBe(false);
    expect(CLINICAL_RETENTION_POLICY.autoPurgeNote).toMatch(/no ejecuta jobs/i);
  });
});

describe("data-retention-policy helpers", () => {
  it("normalizeRetentionYears clamps to allowed range", () => {
    expect(normalizeRetentionYears(3)).toBe(5);
    expect(normalizeRetentionYears(99)).toBe(30);
    expect(normalizeRetentionYears(10)).toBe(10);
    expect(normalizeRetentionYears(null)).toBe(10);
  });

  it("isWithinClinicalRetentionPeriod respects retention window", () => {
    const createdAt = new Date("2020-01-01T00:00:00.000Z");
    expect(isWithinClinicalRetentionPeriod(createdAt, 10, new Date("2025-01-01"))).toBe(true);
    expect(isWithinClinicalRetentionPeriod(createdAt, 10, new Date("2031-01-01"))).toBe(false);
  });

  it("clinicalRecordRetentionUntil adds years", () => {
    const until = clinicalRecordRetentionUntil("2020-06-01", 10);
    expect(until.getFullYear()).toBe(2030);
  });

  it("patientHistoryRetentionUntil uses last clinical entry as clock", () => {
    const until = patientHistoryRetentionUntil("2024-03-15T12:00:00.000Z", 10);
    expect(until?.toISOString().startsWith("2034-03-15")).toBe(true);
    expect(patientHistoryRetentionUntil(null, 10)).toBeNull();
  });

  it("isPatientHistoryWithinRetention follows last-entry anchor", () => {
    expect(
      isPatientHistoryWithinRetention("2020-01-01", 10, new Date("2025-06-01"))
    ).toBe(true);
    expect(
      isPatientHistoryWithinRetention("2010-01-01", 10, new Date("2025-06-01"))
    ).toBe(false);
  });

  it("latestClinicalEntryAt picks the newest timestamp", () => {
    expect(
      latestClinicalEntryAt(["2020-01-01", "2024-06-01", "2022-03-01"])
    ).toBe("2024-06-01");
    expect(latestClinicalEntryAt([])).toBeNull();
  });

  it("buildPatientDeactivationEvaluation requires ack when records exist", () => {
    const withRecords = buildPatientDeactivationEvaluation({
      retentionYears: 10,
      clinicalRecordCount: 2,
      recordsWithinRetention: 2,
      latestRecordAt: "2026-01-01",
    });
    expect(withRecords.requiresRetentionAcknowledgment).toBe(true);
    expect(withRecords.warningMessage).toMatch(/consulta/);
    expect(withRecords.historyRetentionUntil).toMatch(/^2036-01-01/);

    const empty = buildPatientDeactivationEvaluation({
      retentionYears: 10,
      clinicalRecordCount: 0,
      recordsWithinRetention: 0,
      latestRecordAt: null,
    });
    expect(empty.requiresRetentionAcknowledgment).toBe(false);
    expect(empty.historyRetentionUntil).toBeNull();
  });

  it("DATA_RETENTION_CATEGORIES covers core clinical data", () => {
    const ids = DATA_RETENTION_CATEGORIES.map((c) => c.id);
    expect(ids).toContain("clinical_records");
    expect(ids).toContain("audit_logs");
    expect(ids).toContain("patients");
  });

  it("retentionCategoryYearsLabel uses clinic years for legal_minimum", () => {
    const clinical = DATA_RETENTION_CATEGORIES.find((c) => c.id === "clinical_records")!;
    expect(retentionCategoryYearsLabel(clinical, 12)).toBe("Mínimo 12 años (configurable)");
  });

  it("evaluateRetentionPreservationSupport flags below-default clinic config", () => {
    const ok = evaluateRetentionPreservationSupport(10);
    expect(ok.meetsMinimumAssumption).toBe(true);
    expect(ok.autoPurgeEnabled).toBe(false);

    const low = evaluateRetentionPreservationSupport(5);
    expect(low.meetsMinimumAssumption).toBe(false);
    expect(low.notes.some((n) => n.includes("por debajo"))).toBe(true);
  });
});
