import { describe, expect, it } from "vitest";
import {
  assertSameClinic,
  assertStoragePathInClinic,
  CLINIC_SCOPED_TABLES,
  clinicScopedIdFilter,
  isSameClinic,
  TenantScopeError,
} from "@/core/security/tenant-scope";

describe("tenant-scope", () => {
  const clinicA = "11111111-1111-1111-1111-111111111111";
  const clinicB = "22222222-2222-2222-2222-222222222222";

  it("isSameClinic matches identical clinic ids", () => {
    expect(isSameClinic(clinicA, clinicA)).toBe(true);
    expect(isSameClinic(clinicA, clinicB)).toBe(false);
    expect(isSameClinic(clinicA, null)).toBe(false);
  });

  it("assertSameClinic throws TenantScopeError on mismatch", () => {
    expect(() => assertSameClinic(clinicA, clinicB)).toThrow(TenantScopeError);
    expect(() => assertSameClinic(clinicA, clinicA)).not.toThrow();
  });

  it("clinicScopedIdFilter returns id + clinic_id pair", () => {
    const id = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
    expect(clinicScopedIdFilter(clinicA, id)).toEqual({ clinic_id: clinicA, id });
  });

  it("lists core clinic-scoped tables", () => {
    expect(CLINIC_SCOPED_TABLES).toContain("patients");
    expect(CLINIC_SCOPED_TABLES).toContain("patient_clinical_profiles");
    expect(CLINIC_SCOPED_TABLES).toContain("clinical_records");
  });

  it("assertStoragePathInClinic rejects cross-tenant paths", () => {
    const path = `${clinicA}/import-staging/batch/file.csv`;
    expect(() => assertStoragePathInClinic(clinicA, path)).not.toThrow();
    expect(() => assertStoragePathInClinic(clinicB, path)).toThrow(TenantScopeError);
  });
});

describe("047 + tenant hardening (static)", () => {
  it("historias editar scopes patient by clinic_id", async () => {
    const { readFileSync } = await import("fs");
    const { resolve } = await import("path");
    const src = readFileSync(
      resolve(process.cwd(), "src/app/(dashboard)/historias/[id]/editar/page.tsx"),
      "utf8"
    );
    expect(src).toMatch(/eq\("id", record\.patient_id\)\.eq\("clinic_id", clinicId\)/);
  });

  it("compliance ARCO export scopes appointments by clinic_id", async () => {
    const { readFileSync } = await import("fs");
    const { resolve } = await import("path");
    const src = readFileSync(resolve(process.cwd(), "src/lib/actions/compliance.ts"), "utf8");
    expect(src).toMatch(/from\("appointments"\)[\s\S]*eq\("clinic_id", clinicId\)/);
  });
});
