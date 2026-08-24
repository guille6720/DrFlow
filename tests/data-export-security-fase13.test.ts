import { readFileSync } from "fs";
import { resolve } from "path";
import { describe, expect, it } from "vitest";

import {
  assertExportUrlAllowed,
  buildExportAuditMetadata,
  evaluateDataExportSecurityPosture,
  EXPORT_CACHE_CONTROL_NO_STORE,
  EXPORT_SIGNED_URL_TTL_SECONDS,
  EXPORT_STAGING_PATH_SEGMENT,
  HEALTH_EXPORT_CHANNELS,
  HEALTH_EXPORT_SECURITY_REQUIREMENTS,
  isForbiddenPublicStorageUrl,
} from "@/core/compliance/data-export-security";

const ROOT = process.cwd();

function read(rel: string): string {
  return readFileSync(resolve(ROOT, rel), "utf8");
}

describe("data-export-security policy module", () => {
  it("defines short signed URL TTL and no-store cache", () => {
    expect(EXPORT_SIGNED_URL_TTL_SECONDS).toBe(600);
    expect(EXPORT_CACHE_CONTROL_NO_STORE).toMatch(/no-store/);
    expect(EXPORT_STAGING_PATH_SEGMENT).toBe("export-staging");
  });

  it("covers PHI export channels", () => {
    const channels = HEALTH_EXPORT_CHANNELS.map((c) => c.channel);
    expect(channels).toContain("patient_roster_csv_xlsx");
    expect(channels).toContain("clinical_package_signed_url");
    expect(channels).toContain("bulk_clinical_job");
    expect(channels).toContain("arco_habeas_json");
    expect(HEALTH_EXPORT_CHANNELS.every((c) => c.publicUrlForbidden && c.mustAudit)).toBe(true);
  });

  it("lists required security controls", () => {
    const ids = HEALTH_EXPORT_SECURITY_REQUIREMENTS.map((r) => r.id);
    expect(ids).toEqual(
      expect.arrayContaining([
        "authentication",
        "authorization",
        "tenant_isolation",
        "audit",
        "no_public_urls",
        "url_expiry",
        "no_store_cache",
      ])
    );
  });

  it("rejects public storage URLs", () => {
    expect(
      isForbiddenPublicStorageUrl(
        "https://xyz.supabase.co/storage/v1/object/public/clinical-files/a/b.zip"
      )
    ).toBe(true);
    expect(
      isForbiddenPublicStorageUrl(
        "https://xyz.supabase.co/storage/v1/object/sign/clinical-files/a/b.zip?token=abc"
      )
    ).toBe(false);
    expect(() =>
      assertExportUrlAllowed(
        "https://xyz.supabase.co/storage/v1/object/public/clinical-files/leak.zip"
      )
    ).toThrow(/EXPORT_PUBLIC_URL_FORBIDDEN/);
  });

  it("buildExportAuditMetadata embeds security posture", () => {
    const meta = buildExportAuditMetadata({
      channel: "clinical_package_signed_url",
      format: "zip",
      recordCount: 3,
    });
    expect(meta.export_channel).toBe("clinical_package_signed_url");
    expect(meta.signed_url_ttl_seconds).toBe(EXPORT_SIGNED_URL_TTL_SECONDS);
    expect(meta.public_url_forbidden).toBe(true);
    expect(meta.cache_control).toBe(EXPORT_CACHE_CONTROL_NO_STORE);
  });

  it("evaluateDataExportSecurityPosture is non-empty", () => {
    const posture = evaluateDataExportSecurityPosture();
    expect(posture.publicUrlsForbidden).toBe(true);
    expect(posture.channelCount).toBeGreaterThan(0);
    expect(posture.notes.length).toBeGreaterThan(0);
  });
});

describe("Phase 13 export path wiring (static)", () => {
  it("export-staging uses TTL, clinic assert, and no public URL", () => {
    const src = read("src/lib/server/export-staging.ts");
    expect(src).toContain("EXPORT_SIGNED_URL_TTL_SECONDS");
    expect(src).toContain("createSignedUrl");
    expect(src).toContain("assertStoragePathInClinic");
    expect(src).toContain("assertExportUrlAllowed");
    expect(src).toContain("EXPORT_CACHE_CONTROL_NO_STORE");
    expect(src).not.toContain("getPublicUrl");
  });

  it("clinical package export requires access, tenant check, and audit", () => {
    const src = read("src/features/integraciones/actions/patient-clinical-export.ts");
    expect(src).toContain("requireClinicalExportAccess");
    expect(src).toContain("verifyPatientInClinic");
    expect(src).toContain('action: "export"');
    expect(src).toContain("buildExportAuditMetadata");
    expect(src).toContain("uploadExportStagingFile");
    expect(src).not.toContain("getPublicUrl");
  });

  it("patient roster export gates permission + DATA_EXPORT + audit", () => {
    const src = read("src/features/integraciones/actions/patient-export.ts");
    expect(src).toContain("requirePatientExportAccess");
    expect(src).toContain("FEATURES.DATA_EXPORT");
    expect(src).toContain('action: "export"');
    expect(src).toContain("buildExportAuditMetadata");
    expect(src).toContain('eq("clinic_id", clinicId)');
    expect(src).toContain("toCsvDocument");
  });

  it("bulk export signs staging paths under clinic scope", () => {
    const src = read("src/features/integraciones/actions/bulk-clinical-export.ts");
    expect(src).toContain("requireBulkExportAccess");
    expect(src).toContain("signExportStagingPath");
    expect(src).toContain("buildExportAuditMetadata");
    expect(src).toContain('eq("clinic_id", auth.clinicId)');
    expect(src).not.toContain("getPublicUrl");
  });

  it("ARCO/habeas exports audit with security metadata", () => {
    const src = read("src/lib/actions/compliance.ts");
    expect(src).toContain('action: "export"');
    expect(src).toContain("buildExportAuditMetadata");
    expect(src).toContain("arco_habeas_json");
    expect(src).toContain('eq("clinic_id", clinicId)');
  });

  it("client download of signed URLs uses cache: no-store", () => {
    const src = read("src/features/integraciones/components/datos/download-file.ts");
    expect(src).toContain('cache: "no-store"');
    expect(src).toContain("EXPORT_CACHE_CONTROL_NO_STORE");
  });
});
