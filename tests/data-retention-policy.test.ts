import { readFileSync } from "fs";
import { resolve } from "path";
import { describe, expect, it } from "vitest";

import {
  buildPatientDeactivationEvaluation,
  clinicalRecordRetentionUntil,
  DATA_RETENTION_CATEGORIES,
  isWithinClinicalRetentionPeriod,
  normalizeRetentionYears,
  retentionCategoryYearsLabel,
} from "@/core/compliance/data-retention-policy";

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

  it("constrains retention years between 5 and 30", () => {
    expect(sql).toMatch(/clinical_record_retention_years >= 5/);
    expect(sql).toMatch(/clinical_record_retention_years <= 30/);
  });
});

describe("data-retention-policy", () => {
  it("normalizeRetentionYears clamps to allowed range", () => {
    expect(normalizeRetentionYears(3)).toBe(5);
    expect(normalizeRetentionYears(99)).toBe(30);
    expect(normalizeRetentionYears(10)).toBe(10);
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

  it("buildPatientDeactivationEvaluation requires ack when records exist", () => {
    const withRecords = buildPatientDeactivationEvaluation({
      retentionYears: 10,
      clinicalRecordCount: 2,
      recordsWithinRetention: 2,
      latestRecordAt: "2026-01-01",
    });
    expect(withRecords.requiresRetentionAcknowledgment).toBe(true);
    expect(withRecords.warningMessage).toMatch(/consulta/);

    const empty = buildPatientDeactivationEvaluation({
      retentionYears: 10,
      clinicalRecordCount: 0,
      recordsWithinRetention: 0,
      latestRecordAt: null,
    });
    expect(empty.requiresRetentionAcknowledgment).toBe(false);
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
});
