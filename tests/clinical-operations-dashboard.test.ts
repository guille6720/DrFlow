import { describe, expect, it } from "vitest";
import { buildPatientWorkspaceUrl } from "@/features/pacientes/utils/patient-workspace-actions";

describe("clinical operations dashboard URLs", () => {
  it("links draft prescriptions to in-patient workspace sheet", () => {
    expect(buildPatientWorkspaceUrl("pat-1", { tab: "recetas", action: "nueva" })).toBe(
      "/pacientes/pat-1?tab=recetas&action=nueva"
    );
  });

  it("links overdue consult start to soap sheet", () => {
    expect(
      buildPatientWorkspaceUrl("pat-1", {
        tab: "soap",
        action: "nueva",
        appointment: "appt-1",
      })
    ).toBe("/pacientes/pat-1?tab=soap&action=nueva&appointment=appt-1");
  });
});
