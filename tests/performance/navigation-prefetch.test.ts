import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const root = process.cwd();

function readSrc(relative: string): string {
  return readFileSync(join(root, relative), "utf8");
}

describe("Fase 9 navigation prefers Link prefetch over RSC reloads", () => {
  it("sidebar uses Link with prefetch", () => {
    const source = readSrc("src/core/components/layout/sidebar-nav-content.tsx");
    expect(source).toMatch(/<Link[\s\S]*prefetch/);
    expect(source).not.toMatch(/router\.push/);
  });

  it("HC sidebar updates the URL without router.push/replace", () => {
    const source = readSrc(
      "src/features/historias/components/historias/patient-ehr-interactive-body.tsx"
    );
    expect(source).toMatch(/replaceClientUrl/);
    expect(source).not.toMatch(/router\.(push|replace)/);
  });

  it("patient list and HC group actions prefetch dynamic patient routes", () => {
    expect(readSrc("src/features/pacientes/components/pacientes/patients-list-cards.tsx")).toMatch(
      /prefetch/
    );
    expect(
      readSrc(
        "src/features/historias/components/historias/clinical-records-group-summary-actions.tsx"
      )
    ).toMatch(/prefetch/);
  });

  it("ButtonLink prefetches by default", () => {
    expect(readSrc("src/components/ui/button.tsx")).toMatch(/prefetch = true/);
  });

  it("does not refresh after navigating away from a finished consult", () => {
    const finalize = readSrc(
      "src/features/historias/components/historias/finalize-consultation-button.tsx"
    );
    const session = readSrc(
      "src/features/historias/components/consultas/doctor-consulta-session.tsx"
    );
    expect(finalize).toMatch(/router\.push/);
    expect(finalize).not.toMatch(/router\.refresh/);
    expect(session).toMatch(/router\.push\("\/consultas"\)/);
    expect(session).not.toMatch(/router\.refresh/);
  });

  it("adds loading skeletons on slow clinical destinations", () => {
    for (const file of [
      "src/app/(dashboard)/historias/[id]/loading.tsx",
      "src/app/(dashboard)/dashboard/loading.tsx",
      "src/app/(dashboard)/agenda/loading.tsx",
      "src/app/(dashboard)/turnos/nuevo/loading.tsx",
      "src/app/(dashboard)/sala-espera/loading.tsx",
      "src/app/(dashboard)/pacientes/[id]/loading.tsx",
      "src/app/(dashboard)/consultas/loading.tsx",
    ]) {
      expect(existsSync(join(root, file))).toBe(true);
    }
  });
});
