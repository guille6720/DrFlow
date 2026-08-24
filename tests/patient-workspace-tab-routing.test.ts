import { describe, expect, it } from "vitest";

import {
  chartFocusForTab,
  shouldLoadCopilotBridge,
  shouldLoadWorkspaceSheets,
} from "@/features/pacientes/utils/patient-workspace-tab-routing";

function params(input: Record<string, string>): URLSearchParams {
  return new URLSearchParams(input);
}

describe("patient-workspace-tab-routing", () => {
  it("maps chart focus tabs", () => {
    expect(chartFocusForTab("problemas")).toBe("problemas");
    expect(chartFocusForTab("recetas")).toBeUndefined();
  });

  it("loads copilot bridge on clinical tabs or copilot action", () => {
    expect(shouldLoadCopilotBridge("resumen", null)).toBe(true);
    expect(shouldLoadCopilotBridge("recetas", null)).toBe(false);
    expect(shouldLoadCopilotBridge("recetas", "copilot")).toBe(true);
  });

  it("loads workspace sheets only when URL opens a sheet", () => {
    expect(shouldLoadWorkspaceSheets("resumen", params({}))).toBe(false);
    expect(shouldLoadWorkspaceSheets("soap", params({ action: "nueva" }))).toBe(true);
    expect(shouldLoadWorkspaceSheets("soap", params({ tab: "soap", sheet: "receta" }))).toBe(true);
    expect(shouldLoadWorkspaceSheets("soap", params({ action: "nueva", sheet: "receta" }))).toBe(
      true
    );
    expect(shouldLoadWorkspaceSheets("recetas", params({ action: "nueva" }))).toBe(true);
    expect(shouldLoadWorkspaceSheets("soap", params({ record: "abc" }))).toBe(false);
    expect(shouldLoadWorkspaceSheets("soap", params({ record: "abc", mode: "edit" }))).toBe(true);
    expect(shouldLoadWorkspaceSheets("resumen", params({ action: "certificado" }))).toBe(true);
    expect(shouldLoadWorkspaceSheets("resumen", params({ action: "copilot" }))).toBe(false);
  });
});
