import { describe, expect, it } from "vitest";

import { canAccessRoute, hasPermission } from "@/core/permissions/roles";

describe("Role permissions", () => {
  it("superadmin has all permissions", () => {
    expect(hasPermission("superadmin", "manageSettings", true)).toBe(true);
    expect(hasPermission(null, "manageSettings", true)).toBe(true);
  });

  it("secretary can manage patients but not settings or clinical HC", () => {
    expect(hasPermission("secretary", "managePatients")).toBe(true);
    expect(hasPermission("secretary", "manageSettings")).toBe(false);
    expect(hasPermission("secretary", "viewClinicalRecords")).toBe(false);
    expect(hasPermission("secretary", "manageCashRegister")).toBe(true);
    expect(hasPermission("secretary", "manageWaitingRoom")).toBe(true);
  });

  it("doctor can edit clinical records and access caja if enabled", () => {
    expect(hasPermission("doctor", "editClinicalRecords")).toBe(true);
    expect(hasPermission("doctor", "managePatients")).toBe(true);
    expect(hasPermission("doctor", "managePayments")).toBe(false);
    expect(hasPermission("doctor", "manageCashRegister")).toBe(true);
  });

  it("patient cannot access reports", () => {
    expect(hasPermission("patient", "viewReports")).toBe(false);
    expect(canAccessRoute("patient", "/reportes")).toBe(false);
  });

  it("clinic_admin can access configuration", () => {
    expect(canAccessRoute("clinic_admin", "/configuracion")).toBe(true);
  });

  it("blocks lab routes for non-superadmin roles", () => {
    expect(canAccessRoute("doctor", "/telemedicina")).toBe(false);
    expect(canAccessRoute("clinic_admin", "/pagos")).toBe(false);
    expect(canAccessRoute("doctor", "/qa")).toBe(false);
  });

  it("allows superadmin lab routes", () => {
    expect(canAccessRoute("superadmin", "/qa", true)).toBe(true);
    expect(canAccessRoute(null, "/telemedicina", true)).toBe(true);
  });

  it("requires edit permission for nueva historia", () => {
    expect(canAccessRoute("secretary", "/historias/nueva")).toBe(false);
    expect(canAccessRoute("secretary", "/historias")).toBe(false);
    expect(canAccessRoute("secretary", "/caja")).toBe(true);
    expect(canAccessRoute("secretary", "/sala-espera")).toBe(true);
    expect(canAccessRoute("doctor", "/historias/nueva")).toBe(true);
  });

  it("restricts manageStaff to clinic_admin", () => {
    expect(hasPermission("clinic_admin", "manageStaff")).toBe(true);
    expect(hasPermission("doctor", "manageStaff")).toBe(false);
  });

  it("requires managePatients for paciente editar route", () => {
    expect(canAccessRoute("secretary", "/pacientes/abc/editar")).toBe(true);
    expect(canAccessRoute("patient", "/pacientes/abc/editar")).toBe(false);
  });

  it("allows unknown dashboard routes by default", () => {
    expect(canAccessRoute("doctor", "/dashboard")).toBe(true);
  });
});
