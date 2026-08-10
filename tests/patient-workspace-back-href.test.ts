import { describe, expect, it } from "vitest";

import { patientWorkspaceBackHref } from "@/features/pacientes/utils/patient-workspace-back-href";

describe("patientWorkspaceBackHref", () => {
  const patientId = "patient-1";

  it("returns HC root when viewing a consultation item inside soap", () => {
    expect(
      patientWorkspaceBackHref(patientId, "soap", {
        record: "record-1",
        mode: "view",
      })
    ).toBe("/pacientes/patient-1?tab=soap&action=nueva");
  });

  it("returns HC root from other HC sub-tabs", () => {
    expect(patientWorkspaceBackHref(patientId, "recetas")).toBe(
      "/pacientes/patient-1?tab=soap&action=nueva"
    );
  });

  it("returns patient chart from clean soap tab", () => {
    expect(patientWorkspaceBackHref(patientId, "soap")).toBe("/pacientes/patient-1");
  });

  it("returns patient list from resumen tab", () => {
    expect(patientWorkspaceBackHref(patientId, "resumen")).toBe("/pacientes");
  });

  it("returns patient chart from archivos tab instead of the patient list", () => {
    expect(patientWorkspaceBackHref(patientId, "archivos")).toBe("/pacientes/patient-1");
  });

  it("returns patient chart from estudios tab", () => {
    expect(patientWorkspaceBackHref(patientId, "estudios")).toBe("/pacientes/patient-1");
  });
});
