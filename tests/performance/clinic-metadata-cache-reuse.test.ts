import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const root = process.cwd();

function readSrc(relative: string): string {
  return readFileSync(join(root, relative), "utf8");
}

describe("Fase 10 clinic metadata cache reuse", () => {
  it("hot loaders reuse portal/professionals/templates/coverage cache", () => {
    const workspace = readSrc("src/features/pacientes/server/load-patient-workspace-page.ts");
    expect(workspace).toMatch(/getCachedPortalContext/);
    expect(workspace).toMatch(/getCachedClinicProfessionalsList/);
    expect(workspace).toMatch(/getCachedClinicalTemplates/);
    expect(workspace).toMatch(/getCachedClinicCoverageRules/);
    expect(workspace).not.toMatch(/getPortalContextForClinic/);

    const pacientes = readSrc("src/features/pacientes/server/load-pacientes-page.ts");
    expect(pacientes).toMatch(/getCachedPortalContext/);
    expect(pacientes).not.toMatch(/getPortalContextForClinic/);

    const historia = readSrc("src/features/historias/server/load-historia-detail-page.ts");
    expect(historia).toMatch(/getCachedPortalContext/);
    expect(historia).toMatch(/getCachedClinicProfessionalsFull/);
  });

  it("agenda and turnos pages reuse locations/specialties/professionals cache", () => {
    const agenda = readSrc("src/app/(dashboard)/turnos/agenda/page.tsx");
    expect(agenda).toMatch(/getCachedClinicProfessionalsAgenda/);
    expect(agenda).toMatch(/getCachedClinicLocations/);
    expect(agenda).toMatch(/getCachedClinicSpecialties/);

    const nuevo = readSrc("src/app/(dashboard)/turnos/nuevo/page.tsx");
    expect(nuevo).toMatch(/getCachedClinicProfessionalsAgenda/);
    expect(nuevo).toMatch(/getCachedClinicSettings/);
  });

  it("firmas and plantillas-recetas reuse professionals list cache", () => {
    const firmas = readSrc("src/app/(dashboard)/firmas/page.tsx");
    expect(firmas).toMatch(/getCachedClinicProfessionalsList/);
    expect(firmas).not.toMatch(/\.from\(["']professionals["']\)/);

    const plantillas = readSrc("src/app/(dashboard)/plantillas-recetas/page.tsx");
    expect(plantillas).toMatch(/getCachedClinicProfessionalsList/);
    expect(plantillas).not.toMatch(/\.from\(["']professionals["']\)/);
  });

  it("prescription coverage overrides read the clinic coverage-rules cache", () => {
    const source = readSrc("src/features/recetas/actions/coverage-rules.ts");
    expect(source).toMatch(/getCachedClinicCoverageRules/);
    expect(source).toMatch(/getPrescriptionCoverageRuleOverrides/);
    expect(source).not.toMatch(/loadActiveCoverageRulesForClinic/);
  });

  it("does not put PHI tables in the clinic metadata cache layer", () => {
    const metadata = readSrc("src/lib/server/cached-clinic-metadata.ts");
    expect(metadata).not.toMatch(/\.from\(["']patients["']\)/);
    expect(metadata).not.toMatch(/\.from\(["']clinical_records["']\)/);
    expect(metadata).not.toMatch(/\.from\(["']prescription_drafts["']\)/);
    expect(metadata).not.toMatch(/\.from\(["']appointments["']\)/);
    expect(metadata).toMatch(/coverage-rules/);
    expect(metadata).toMatch(/professionals-list-v2/);
  });

  it("dashboard shell reuses feature flags/plugins cache", () => {
    const shell = readSrc("src/core/components/layout/dashboard-data-shell.tsx");
    expect(shell).toMatch(/getCachedClinicFeatures/);
  });
});
