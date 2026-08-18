import { describe, expect, it } from "vitest";

import { canAccessRoute, hasPermission, isInvitedClinicMember } from "@/core/permissions/roles";

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

  it("allows doctors to access telemedicina", () => {
    expect(canAccessRoute("doctor", "/telemedicina")).toBe(true);
  });

  it("allows doctors to access Gemini and blocks secretaría", () => {
    expect(canAccessRoute("doctor", "/gemini")).toBe(true);
    expect(canAccessRoute("secretary", "/gemini")).toBe(false);
  });

  it("blocks lab routes for non-superadmin roles", () => {
    expect(canAccessRoute("clinic_admin", "/pagos")).toBe(false);
    expect(canAccessRoute("doctor", "/qa")).toBe(false);
  });

  it("allows superadmin lab routes", () => {
    expect(canAccessRoute("superadmin", "/qa", true)).toBe(true);
    expect(canAccessRoute(null, "/pagos", true)).toBe(true);
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

  it("gates /datos behind import/export permissions", () => {
    expect(canAccessRoute("doctor", "/datos")).toBe(true);
    expect(canAccessRoute("secretary", "/datos")).toBe(true);
    expect(canAccessRoute("patient", "/datos")).toBe(false);
  });

  it("identifies invited clinic members", () => {
    expect(isInvitedClinicMember("doctor")).toBe(true);
    expect(isInvitedClinicMember("secretary")).toBe(true);
    expect(isInvitedClinicMember("clinic_admin")).toBe(false);
    expect(isInvitedClinicMember("doctor", true)).toBe(false);
    expect(isInvitedClinicMember(null)).toBe(false);
  });

  it("applies permission overrides for manageable keys", () => {
    expect(
      hasPermission("secretary", "viewClinicalRecords", false, { viewClinicalRecords: true })
    ).toBe(true);
    expect(
      hasPermission("doctor", "manageCashRegister", false, { manageCashRegister: false })
    ).toBe(false);
  });

  it("maps dashboard routes to permission keys", () => {
    expect(canAccessRoute("secretary", "/reportes")).toBe(true);
    expect(canAccessRoute("doctor", "/reportes")).toBe(false);
    expect(canAccessRoute("doctor", "/recetas")).toBe(true);
    expect(canAccessRoute("secretary", "/recetas")).toBe(false);
    expect(canAccessRoute("doctor", "/herramientas")).toBe(true);
    expect(canAccessRoute("doctor", "/turnos/nuevo")).toBe(true);
    expect(canAccessRoute("doctor", "/ingreso-profesionales")).toBe(false);
    expect(canAccessRoute("clinic_admin", "/ingreso-profesionales")).toBe(true);
    expect(canAccessRoute("doctor", "/plantillas")).toBe(true);
    expect(canAccessRoute("doctor", "/historias/abc/editar")).toBe(true);
    expect(canAccessRoute("secretary", "/historias/abc/editar")).toBe(false);
  });

  it("denies permissions for null role", () => {
    expect(hasPermission(null, "managePatients")).toBe(false);
  });
});
