import { describe, expect, it } from "vitest";

import { resolveApiClinicAccess } from "@/core/auth/resolve-api-clinic-access";

const ROLES = new Set(["superadmin", "clinic_admin", "doctor", "secretary"]);

describe("resolveApiClinicAccess", () => {
  it("keeps cookie clinic for superadmin who is also a member of another clinic", () => {
    const result = resolveApiClinicAccess({
      cookieClinicId: "clinic-b",
      members: [{ clinic_id: "clinic-a", role: "clinic_admin" }],
      isSuperadmin: true,
      allowedRoles: ROLES,
    });
    expect(result).toEqual({ ok: true, clinicId: "clinic-b" });
  });

  it("falls back to membership when superadmin has no cookie", () => {
    const result = resolveApiClinicAccess({
      cookieClinicId: null,
      members: [{ clinic_id: "clinic-a", role: "clinic_admin" }],
      isSuperadmin: true,
      allowedRoles: ROLES,
    });
    expect(result).toEqual({ ok: true, clinicId: "clinic-a" });
  });

  it("allows cookie-only clinic for membership-less superadmin", () => {
    const result = resolveApiClinicAccess({
      cookieClinicId: "clinic-x",
      members: [],
      isSuperadmin: true,
      allowedRoles: ROLES,
    });
    expect(result).toEqual({ ok: true, clinicId: "clinic-x" });
  });

  it("remaps invalid cookie to membership for non-superadmin", () => {
    const result = resolveApiClinicAccess({
      cookieClinicId: "clinic-foreign",
      members: [{ clinic_id: "clinic-a", role: "secretary" }],
      isSuperadmin: false,
      allowedRoles: ROLES,
    });
    expect(result).toEqual({ ok: true, clinicId: "clinic-a" });
  });

  it("denies non-superadmin without membership", () => {
    const result = resolveApiClinicAccess({
      cookieClinicId: "clinic-x",
      members: [],
      isSuperadmin: false,
      allowedRoles: ROLES,
    });
    expect(result).toEqual({ ok: false, error: "Sin permisos", status: 403 });
  });
});
