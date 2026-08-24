import { readFileSync } from "fs";
import { resolve } from "path";
import { describe, expect, it } from "vitest";

import {
  assertClinicalStorageUrlAllowed,
  classifyClinicalStoragePath,
  CLINICAL_DOWNLOAD_SIGNED_URL_TTL_SECONDS,
  CLINICAL_STORAGE_BUCKET,
  CLINICAL_STORAGE_SECURITY_REQUIREMENTS,
  CLINICAL_STORAGE_SURFACES,
  evaluateStorageSecurityPosture,
  EXPORT_SIGNED_URL_TTL_SECONDS,
  isForbiddenPublicStorageUrl,
  SIGNATURE_SIGNED_URL_TTL_SECONDS,
} from "@/core/compliance/storage-security";

const ROOT = process.cwd();

function read(rel: string): string {
  return readFileSync(resolve(ROOT, rel), "utf8");
}

describe("storage-security policy module", () => {
  it("keeps clinical bucket private with explicit TTLs", () => {
    expect(CLINICAL_STORAGE_BUCKET).toBe("clinical-files");
    expect(CLINICAL_DOWNLOAD_SIGNED_URL_TTL_SECONDS).toBe(900);
    expect(EXPORT_SIGNED_URL_TTL_SECONDS).toBe(600);
    expect(SIGNATURE_SIGNED_URL_TTL_SECONDS).toBe(3600);
  });

  it("covers clinical storage surfaces", () => {
    const ids = CLINICAL_STORAGE_SURFACES.map((s) => s.id);
    expect(ids).toEqual(
      expect.arrayContaining([
        "patient_attachments",
        "admin_documents",
        "import_staging",
        "export_staging",
        "professional_signatures",
      ])
    );
    expect(CLINICAL_STORAGE_SURFACES.every((s) => s.publicForbidden)).toBe(true);
  });

  it("lists required storage controls", () => {
    const ids = CLINICAL_STORAGE_SECURITY_REQUIREMENTS.map((r) => r.id);
    expect(ids).toEqual(
      expect.arrayContaining([
        "private_bucket",
        "storage_rls",
        "no_object_update",
        "signed_urls_only",
        "url_expiry",
        "clinic_path_prefix",
      ])
    );
  });

  it("classifies path zones", () => {
    const clinic = "11111111-1111-1111-1111-111111111111";
    expect(classifyClinicalStoragePath(`${clinic}/patients/p1/x.pdf`)).toBe("patients");
    expect(classifyClinicalStoragePath(`${clinic}/p1/admin/x.pdf`)).toBe("admin_legacy");
    expect(classifyClinicalStoragePath(`${clinic}/import-staging/a.csv`)).toBe("import_staging");
    expect(classifyClinicalStoragePath(`${clinic}/export-staging/b.zip`)).toBe("export_staging");
    expect(classifyClinicalStoragePath(`${clinic}/signatures/pro/s.png`)).toBe("signatures");
  });

  it("rejects public storage URLs", () => {
    expect(
      isForbiddenPublicStorageUrl(
        "https://xyz.supabase.co/storage/v1/object/public/clinical-files/a/b.pdf"
      )
    ).toBe(true);
    expect(() =>
      assertClinicalStorageUrlAllowed(
        "https://xyz.supabase.co/storage/v1/object/public/clinical-files/leak.pdf"
      )
    ).toThrow();
  });

  it("evaluateStorageSecurityPosture reports private-only posture", () => {
    const posture = evaluateStorageSecurityPosture();
    expect(posture.publicBucketForbidden).toBe(true);
    expect(posture.bucket).toBe("clinical-files");
    expect(posture.notes.length).toBeGreaterThan(0);
  });
});

describe("136_storage_security migration", () => {
  const sql = read("supabase/migrations/136_storage_security.sql");

  it("forces clinical-files public = false", () => {
    expect(sql).toMatch(/public\s*=\s*false/);
    expect(sql).toMatch(/clinical-files/);
  });

  it("classifies export-staging and signatures", () => {
    expect(sql).toMatch(/export-staging/);
    expect(sql).toMatch(/signatures/);
    expect(sql).toMatch(/'signature'/);
  });

  it("reaffirms SELECT/INSERT/DELETE without UPDATE policy", () => {
    expect(sql).toMatch(/clinical_files_select/);
    expect(sql).toMatch(/clinical_files_insert/);
    expect(sql).toMatch(/clinical_files_delete/);
    expect(sql).toMatch(/DROP POLICY IF EXISTS clinical_files_update/);
    expect(sql).toMatch(/Intentionally no UPDATE policy/);
  });

  it("restores MIME types for zip/csv/images", () => {
    expect(sql).toMatch(/application\/zip/);
    expect(sql).toMatch(/text\/csv/);
    expect(sql).toMatch(/image\/jpeg/);
  });
});

describe("Phase 14 app wiring (static)", () => {
  it("patient attachments use TTL + path assert + signed URL", () => {
    const src = read("src/features/pacientes/actions/patient-attachments.ts");
    expect(src).toContain("CLINICAL_DOWNLOAD_SIGNED_URL_TTL_SECONDS");
    expect(src).toContain("assertStoragePathInClinic");
    expect(src).toContain("createSignedUrl");
    expect(src).toContain("assertClinicalStorageUrlAllowed");
    expect(src).not.toContain("getPublicUrl");
  });

  it("admin documents use TTL + path assert + signed URL", () => {
    const src = read("src/lib/actions/admin-documents.ts");
    expect(src).toContain("CLINICAL_DOWNLOAD_SIGNED_URL_TTL_SECONDS");
    expect(src).toContain("assertStoragePathInClinic");
    expect(src).toContain("createSignedUrl");
    expect(src).toContain("assertClinicalStorageUrlAllowed");
    expect(src).not.toContain("getPublicUrl");
  });

  it("export staging uses private bucket + short TTL", () => {
    const src = read("src/lib/server/export-staging.ts");
    expect(src).toContain("CLINICAL_STORAGE_BUCKET");
    expect(src).toContain("EXPORT_SIGNED_URL_TTL_SECONDS");
    expect(src).toContain("assertStoragePathInClinic");
    expect(src).toContain("assertExportUrlAllowed");
    expect(src).not.toContain("getPublicUrl");
  });

  it("signature URL resolver scopes paths to clinic when provided", () => {
    const src = read("src/lib/server/resolve-professional-signature-urls.ts");
    expect(src).toContain("assertStoragePathInClinic");
    expect(src).toContain("SIGNATURE_SIGNED_URL_TTL_SECONDS");
    expect(src).toContain("assertClinicalStorageUrlAllowed");
    expect(src).toContain("createSignedUrls");
  });

  it("cached clinic metadata passes clinicId into signature signing", () => {
    const src = read("src/lib/server/cached-clinic-metadata.ts");
    expect(src).toMatch(/resolveProfessionalSignatureUrls\(supabase, rows, clinicId\)/);
    expect(src).toMatch(/signProfessionalRows\(rows, clinicId\)/);
  });

  it("028 creates private clinical-files bucket", () => {
    const sql = read("supabase/migrations/028_clinical_files_storage.sql");
    expect(sql).toMatch(/public\s*=\s*false/);
  });
});
