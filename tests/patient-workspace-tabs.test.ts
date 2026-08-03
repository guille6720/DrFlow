import { describe, expect, it } from "vitest";
import {
  parsePatientWorkspaceTab,
  patientWorkspacePath,
  LEGACY_TAB_ALIASES,
} from "@/lib/constants/patient-workspace-tabs";
import { patientClinicalHistoryPath } from "@/lib/utils/clinical-navigation";

describe("parsePatientWorkspaceTab", () => {
  it("defaults to resumen for unknown values", () => {
    expect(parsePatientWorkspaceTab(null)).toBe("resumen");
    expect(parsePatientWorkspaceTab("invalid")).toBe("resumen");
  });

  it("accepts valid tab ids", () => {
    expect(parsePatientWorkspaceTab("evoluciones")).toBe("evoluciones");
    expect(parsePatientWorkspaceTab("timeline")).toBe("timeline");
  });
});

describe("patientWorkspacePath", () => {
  it("omits query for default tab", () => {
    expect(patientWorkspacePath("abc")).toBe("/pacientes/abc");
  });

  it("includes tab query for non-default tabs", () => {
    expect(patientWorkspacePath("abc", "recetas")).toBe("/pacientes/abc?tab=recetas");
  });
});

describe("patientClinicalHistoryPath", () => {
  it("points to evoluciones workspace tab", () => {
    expect(patientClinicalHistoryPath("xyz")).toBe("/pacientes/xyz?tab=evoluciones");
  });
});

describe("LEGACY_TAB_ALIASES", () => {
  it("maps historia to evoluciones", () => {
    expect(LEGACY_TAB_ALIASES.historia).toBe("evoluciones");
  });
});
