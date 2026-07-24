import { describe, it, expect } from "vitest";
import { hasPermission, canAccessRoute } from "@/lib/permissions/roles";

describe("Role permissions", () => {
  it("superadmin has all permissions", () => {
    expect(hasPermission("superadmin", "manageSettings", true)).toBe(true);
    expect(hasPermission(null, "manageSettings", true)).toBe(true);
  });

  it("secretary can manage patients but not settings", () => {
    expect(hasPermission("secretary", "managePatients")).toBe(true);
    expect(hasPermission("secretary", "manageSettings")).toBe(false);
  });

  it("doctor can edit clinical records and manage patients", () => {
    expect(hasPermission("doctor", "editClinicalRecords")).toBe(true);
    expect(hasPermission("doctor", "managePatients")).toBe(true);
    expect(hasPermission("doctor", "managePayments")).toBe(false);
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
    expect(canAccessRoute("doctor", "/historias/nueva")).toBe(true);
  });
});
