import { readFileSync } from "fs";
import { resolve } from "path";
import { describe, expect, it } from "vitest";

import {
  CLINICAL_HISTORY_RESET_ENV_FLAG,
  CLINICAL_LIFECYCLE_STATUSES,
  clinicalLifecycleLabel,
  isArchivableLifecycle,
  isClinicalHardDeleteError,
  isClinicalHistoryResetEnabled,
  parsePurgeClinicClinicalDataResult,
  PRIVACY_VS_RETENTION,
} from "@/core/compliance/clinical-deletion-protection";

describe("131_clinical_deletion_protection migration", () => {
  const sql = readFileSync(
    resolve(process.cwd(), "supabase/migrations/131_clinical_deletion_protection.sql"),
    "utf8"
  );

  it("adds lifecycle columns on clinical_records", () => {
    expect(sql).toMatch(/lifecycle_status/);
    expect(sql).toMatch(/archived_at/);
    expect(sql).toMatch(/archive_reason/);
  });

  it("blocks hard DELETE unless migration GUC is set", () => {
    expect(sql).toMatch(/prevent_clinical_hard_delete/);
    expect(sql).toMatch(/app\.allow_clinical_hard_delete/);
    expect(sql).toMatch(/CLINICAL_HARD_DELETE_FORBIDDEN/);
  });

  it("protects issued prescriptions from hard delete", () => {
    expect(sql).toMatch(/prevent_issued_prescription_hard_delete/);
    expect(sql).toMatch(/ISSUED_PRESCRIPTION_DELETE_FORBIDDEN/);
  });

  it("exposes archive and migration purge RPCs", () => {
    expect(sql).toMatch(/archive_clinical_record/);
    expect(sql).toMatch(/purge_clinic_clinical_data_for_migration/);
    expect(sql).toMatch(/BORRAR HISTORIAS/);
    expect(sql).toMatch(/TO service_role/);
  });

  it("allows audit DELETE only during migration GUC", () => {
    expect(sql).toMatch(/prevent_audit_mutation/);
    expect(sql).toMatch(/allow_clinical_hard_delete/);
  });
});

describe("clinical-deletion-protection helpers", () => {
  it("gates migration reset behind ALLOW_CLINICAL_HISTORY_RESET", () => {
    expect(CLINICAL_HISTORY_RESET_ENV_FLAG).toBe("ALLOW_CLINICAL_HISTORY_RESET");
    expect(isClinicalHistoryResetEnabled({ ALLOW_CLINICAL_HISTORY_RESET: "true" })).toBe(true);
    expect(isClinicalHistoryResetEnabled({ ALLOW_CLINICAL_HISTORY_RESET: "false" })).toBe(false);
    expect(isClinicalHistoryResetEnabled({})).toBe(false);
  });

  it("recognizes archivable lifecycle statuses", () => {
    expect(CLINICAL_LIFECYCLE_STATUSES).toContain("archived");
    expect(isArchivableLifecycle("archived")).toBe(true);
    expect(isArchivableLifecycle("active")).toBe(false);
    expect(clinicalLifecycleLabel("corrected")).toBe("Corregida");
  });

  it("parses purge RPC payload", () => {
    expect(
      parsePurgeClinicClinicalDataResult({
        clinical_records_deleted: 3,
        attachments_deleted: 1,
        prescription_drafts_deleted: 2,
      })
    ).toEqual({
      clinical_records_deleted: 3,
      attachments_deleted: 1,
      prescription_drafts_deleted: 2,
    });
    expect(parsePurgeClinicClinicalDataResult(null)).toBeNull();
  });

  it("detects clinical hard-delete errors", () => {
    expect(isClinicalHardDeleteError("CLINICAL_HARD_DELETE_FORBIDDEN: blocked")).toBe(true);
    expect(isClinicalHardDeleteError("ok")).toBe(false);
  });

  it("documents privacy vs retention distinction", () => {
    expect(PRIVACY_VS_RETENTION.productRule).toMatch(/NO autoriza/);
    expect(PRIVACY_VS_RETENTION.privacyRights.length).toBeGreaterThan(0);
    expect(PRIVACY_VS_RETENTION.retentionObligations.length).toBeGreaterThan(0);
  });
});
