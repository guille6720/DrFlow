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
    expect(parsePatientWorkspaceTab("soap")).toBe("soap");
    expect(parsePatientWorkspaceTab("timeline")).toBe("timeline");
  });

  it("resolves legacy tab aliases", () => {
    expect(parsePatientWorkspaceTab("evoluciones")).toBe("soap");
    expect(parsePatientWorkspaceTab("vitales")).toBe("resumen");
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
  it("points to soap workspace tab", () => {
    expect(patientClinicalHistoryPath("xyz")).toBe("/pacientes/xyz?tab=soap");
  });
});

describe("LEGACY_TAB_ALIASES", () => {
  it("maps historia to soap", () => {
    expect(LEGACY_TAB_ALIASES.historia).toBe("soap");
  });
});
