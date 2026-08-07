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
    ).toBe("/pacientes/patient-1?tab=soap");
  });

  it("returns HC root from other HC sub-tabs", () => {
    expect(patientWorkspaceBackHref(patientId, "recetas")).toBe("/pacientes/patient-1?tab=soap");
  });

  it("returns patient chart from clean soap tab", () => {
    expect(patientWorkspaceBackHref(patientId, "soap")).toBe("/pacientes/patient-1");
  });

  it("returns patient list from non-HC tabs", () => {
    expect(patientWorkspaceBackHref(patientId, "resumen")).toBe("/pacientes");
  });
});
