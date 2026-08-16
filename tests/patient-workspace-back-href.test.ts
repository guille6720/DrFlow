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

  it("returns patient list from resumen tab", () => {
    expect(patientWorkspaceBackHref(patientId, "resumen")).toBe("/pacientes");
  });

  it("returns patient chart from archivos tab instead of the patient list", () => {
    expect(patientWorkspaceBackHref(patientId, "archivos")).toBe("/pacientes/patient-1");
  });

  it("returns patient chart from estudios tab", () => {
    expect(patientWorkspaceBackHref(patientId, "estudios")).toBe("/pacientes/patient-1");
  });

  it("returns consulta session when from=consulta with appointment", () => {
    expect(
      patientWorkspaceBackHref(patientId, "soap", {
        from: "consulta",
        appointment: "appt-1",
        professional: "pro-1",
      })
    ).toBe("/consultas?appointment=appt-1&action=nueva&professional=pro-1");
  });

  it("returns consulta session when from=consulta with patient fallback", () => {
    expect(
      patientWorkspaceBackHref(patientId, "soap", {
        from: "consulta",
        professional: "pro-1",
      })
    ).toBe("/consultas?patient=patient-1&action=nueva&professional=pro-1");
  });
});
