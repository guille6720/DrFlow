import { describe, expect, it } from "vitest";

import {
  parsePatientIdFromPath,
  patientWorkflowHref,
  WORKFLOW_CLICK_BEFORE,
  WORKFLOW_CLICK_TARGETS,
  workflowClickReduction,
} from "@/lib/utils/clinical-workflow-context";

describe("parsePatientIdFromPath", () => {
  it("extracts patient id from workspace url", () => {
    expect(parsePatientIdFromPath("/pacientes/abc-123")).toBe("abc-123");
    expect(parsePatientIdFromPath("/pacientes/abc-123/editar")).toBe("abc-123");
  });

  it("ignores nuevo and non-patient paths", () => {
    expect(parsePatientIdFromPath("/pacientes/nuevo")).toBeNull();
    expect(parsePatientIdFromPath("/agenda")).toBeNull();
  });
});

describe("patientWorkflowHref", () => {
  it("builds deep links for clinical actions", () => {
    expect(patientWorkflowHref("p1", "soap")).toContain("/pacientes/p1");
    expect(patientWorkflowHref("p1", "soap")).toContain("tab=soap");
    expect(patientWorkflowHref("p1", "soap")).toContain("action=nueva");
    expect(patientWorkflowHref("p1", "prescription")).toContain("tab=recetas");
    expect(patientWorkflowHref("p1", "order")).toContain("tab=ordenes");
  });
});

describe("workflowClickReduction", () => {
  it("meets click targets for all workflows", () => {
    for (const key of Object.keys(WORKFLOW_CLICK_TARGETS) as Array<
      keyof typeof WORKFLOW_CLICK_TARGETS
    >) {
      const { after } = workflowClickReduction(key);
      expect(after).toBeLessThanOrEqual(WORKFLOW_CLICK_TARGETS[key]);
      expect(WORKFLOW_CLICK_BEFORE[key]).toBeGreaterThan(after);
    }
  });

  it("reports savings for search patient", () => {
    const m = workflowClickReduction("searchPatient");
    expect(m).toEqual({ before: 4, after: 2, saved: 2, pct: 50 });
  });
});
