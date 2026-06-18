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

  it("doctor can edit clinical records", () => {
    expect(hasPermission("doctor", "editClinicalRecords")).toBe(true);
    expect(hasPermission("doctor", "managePayments")).toBe(false);
  });

  it("patient cannot access reports", () => {
    expect(hasPermission("patient", "viewReports")).toBe(false);
    expect(canAccessRoute("patient", "/reportes")).toBe(false);
  });

  it("clinic_admin can access configuration", () => {
    expect(canAccessRoute("clinic_admin", "/configuracion")).toBe(true);
  });
});
