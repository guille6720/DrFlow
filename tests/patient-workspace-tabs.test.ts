import { describe, expect, it } from "vitest";

import { patientClinicalHistoryPath } from "@/shared/utils/clinical-navigation";

import {
  LEGACY_TAB_ALIASES,
  parsePatientWorkspaceTab,
  patientWorkspacePath,
} from "@/features/pacientes/constants/patient-workspace-tabs";

describe("parsePatientWorkspaceTab", () => {
  it("defaults to resumen for unknown values", () => {
    expect(parsePatientWorkspaceTab(null)).toBe("resumen");
    expect(parsePatientWorkspaceTab("invalid")).toBe("resumen");
  });

  it("accepts valid tab ids", () => {
    expect(parsePatientWorkspaceTab("soap")).toBe("soap");
    expect(parsePatientWorkspaceTab("timeline")).toBe("timeline");
    expect(parsePatientWorkspaceTab("docs_admin")).toBe("docs_admin");
  });

  it("resolves legacy tab aliases", () => {
    expect(parsePatientWorkspaceTab("evoluciones")).toBe("soap");
    expect(parsePatientWorkspaceTab("vitales")).toBe("resumen");
    expect(parsePatientWorkspaceTab("hc")).toBe("soap");
  });
});

describe("patientWorkspacePath", () => {
  it("omits query for default tab", () => {
    expect(patientWorkspacePath("abc")).toBe("/pacientes/abc");
  });

  it("includes tab query for non-default tabs", () => {
    expect(patientWorkspacePath("abc", "recetas")).toBe("/pacientes/abc?tab=recetas");
    expect(patientWorkspacePath("abc", "soap")).toBe("/pacientes/abc?tab=soap&action=nueva");
  });
});

describe("patientClinicalHistoryPath", () => {
  it("points to soap workspace tab", () => {
    expect(patientClinicalHistoryPath("xyz")).toBe("/pacientes/xyz?tab=soap&action=nueva");
  });
});

describe("LEGACY_TAB_ALIASES", () => {
  it("maps historia to soap", () => {
    expect(LEGACY_TAB_ALIASES.historia).toBe("soap");
  });
});
