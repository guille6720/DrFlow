import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

describe("React/Next perf optimizations", () => {
  it("turnos nuevo page prefetches wizard slots on the server", () => {
    const page = readFileSync(
      join(process.cwd(), "src/app/(dashboard)/turnos/nuevo/page.tsx"),
      "utf8"
    );
    expect(page).toMatch(/loadTurnosWizardSlots/);
    expect(page).toMatch(/initialWizardSlots/);
  });

  it("turnos wizard accepts SSR slot payload", () => {
    const wizard = readFileSync(
      join(process.cwd(), "src/features/turnos/components/turnos-nuevo-wizard.tsx"),
      "utf8"
    );
    expect(wizard).toMatch(/initialWizardSlots\?:/);
    expect(wizard).toMatch(/prefetchedProfessionalIdRef/);
  });

  it("patient audit panel supports SSR initial events", () => {
    const panel = readFileSync(
      join(process.cwd(), "src/features/pacientes/components/pacientes/patient-clinical-audit-panel.tsx"),
      "utf8"
    );
    expect(panel).toMatch(/initialEvents\?:/);
    expect(panel).toMatch(/serverPrefetched/);
  });

  it("fetch-patient-search is not a client module", () => {
    const util = readFileSync(
      join(process.cwd(), "src/features/pacientes/utils/fetch-patient-search.ts"),
      "utf8"
    );
    expect(util.startsWith('"use client"')).toBe(false);
  });
});
