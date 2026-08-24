import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

describe("Grupo 4 architecture performance", () => {
  it("patient workspace tab hook syncs query params for client navigation", () => {
    const source = readFileSync(
      join(process.cwd(), "src/features/pacientes/hooks/use-patient-workspace-tab.ts"),
      "utf8"
    );
    expect(source).toMatch(/replaceClientUrl/);
    expect(source).toMatch(/workspaceSearchParams/);
    expect(source).toMatch(/navigateWorkspace/);
    expect(source).not.toMatch(/router\.push/);
  });

  it("patient workspace shell lazy-loads tab panels via server action", () => {
    const source = readFileSync(
      join(process.cwd(), "src/features/pacientes/components/pacientes/patient-workspace-shell.tsx"),
      "utf8"
    );
    expect(source).toMatch(/loadPatientWorkspaceTabPanel/);
    expect(source).toMatch(/PatientWorkspacePanelSkeleton/);
  });

  it("ingreso profesionales page loads sidebar separately from detail", () => {
    const page = readFileSync(
      join(process.cwd(), "src/app/(dashboard)/ingreso-profesionales/page.tsx"),
      "utf8"
    );
    expect(page).toMatch(/loadProfessionalIntakeSidebar/);
    expect(page).toMatch(/loadProfessionalIntakeDetail/);
    expect(page).toMatch(/sidebarProfessionals/);
    expect(page).not.toMatch(/scheduleByProfessional/);
  });

  it("route prefetcher scopes routes by role", () => {
    const source = readFileSync(
      join(process.cwd(), "src/core/components/layout/route-prefetcher.tsx"),
      "utf8"
    );
    expect(source).toMatch(/routesForRole/);
    expect(source).not.toMatch(/DASHBOARD_ROUTES = \[[\s\S]*\/ayuda/);
    expect(source).not.toMatch(/"\/historias"/);
  });

  it("patient workspace actions use client navigation when wired", () => {
    const source = readFileSync(
      join(process.cwd(), "src/features/pacientes/hooks/use-patient-workspace-actions.ts"),
      "utf8"
    );
    expect(source).toMatch(/navigation\.navigateWorkspace/);
    expect(source).toMatch(/if \(navigation\)/);
  });

  it("professional intake navigation uses replaceState", () => {
    const source = readFileSync(
      join(process.cwd(), "src/features/profesionales/hooks/use-professional-intake.ts"),
      "utf8"
    );
    expect(source).toMatch(/history\.replaceState/);
    expect(source).toMatch(/loadProfessionalIntakeDetailPanel/);
  });
});
