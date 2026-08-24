import { readFileSync } from "fs";
import { resolve } from "path";
import { describe, expect, it } from "vitest";

import {
  CLINICAL_RECORD_VERSIONED_FIELDS,
  extractRecordVersion,
  summarizeClinicalRecordChanges,
} from "@/core/compliance/clinical-record-integrity";

describe("130_clinical_record_integrity migration", () => {
  const sql = readFileSync(
    resolve(process.cwd(), "supabase/migrations/130_clinical_record_integrity.sql"),
    "utf8"
  );

  it("adds record_version to clinical_records", () => {
    expect(sql).toMatch(/clinical_records[\s\S]*record_version INTEGER NOT NULL DEFAULT 1/);
  });

  it("adds change_reason to clinical_record_audit", () => {
    expect(sql).toMatch(/clinical_record_audit[\s\S]*change_reason TEXT/);
  });

  it("bumps record_version in update_clinical_record_atomic", () => {
    expect(sql).toMatch(/record_version = COALESCE\(v_old\.record_version, 1\) \+ 1/);
    expect(sql).toMatch(/change_reason/);
  });
});

describe("clinical-record-integrity helpers", () => {
  it("summarizeClinicalRecordChanges lists Spanish labels for SOAP deltas", () => {
    const changes = summarizeClinicalRecordChanges(
      { evolution: "HTA estable", record_version: 1 },
      { evolution: "HTA descompensada", record_version: 2 }
    );
    expect(changes).toContain("Evolución");
    expect(changes).toContain("Versión");
    expect(changes).not.toContain("HTA");
  });

  it("extractRecordVersion reads numeric version from snapshot", () => {
    expect(extractRecordVersion({ record_version: 3 })).toBe(3);
    expect(extractRecordVersion({})).toBeNull();
  });

  it("tracks structured dx/tx fields", () => {
    expect(CLINICAL_RECORD_VERSIONED_FIELDS).toContain("diagnoses_json");
    expect(CLINICAL_RECORD_VERSIONED_FIELDS).toContain("treatments_json");
  });
});
