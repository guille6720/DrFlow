import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { loadConfiguracionSectionExtras } from "@/features/configuracion/server/load-configuracion-section-extras";

describe("Grupo 3 frontend performance", () => {
  it("loads configuracion extras only for the active section", async () => {
    const empty = await loadConfiguracionSectionExtras(undefined, "clinic-1");
    expect(empty.pluginSettings).toEqual([]);
    expect(empty.flagSettings).toEqual([]);
    expect(empty.jobSettings).toEqual([]);
    expect(empty.observability).toBeUndefined();
  });

  it("agenda view uses dynamic dialog imports and no embedded header", () => {
    const source = readFileSync(
      join(process.cwd(), "src/features/agenda/components/agenda/agenda-view.tsx"),
      "utf8"
    );
    expect(source).toMatch(/dynamic\(/);
    expect(source).toMatch(/EditAppointmentDialog/);
    expect(source).not.toMatch(/from "@\/core\/components\/layout\/header"/);
  });

  it("clinical ops realtime avoids periodic polling", () => {
    const source = readFileSync(
      join(
        process.cwd(),
        "src/features/dashboard/components/dashboard/clinical-ops-center/clinical-ops-realtime.tsx"
      ),
      "utf8"
    );
    expect(source).not.toMatch(/setInterval/);
  });

  it("cash register form uses remote patient search", () => {
    const source = readFileSync(
      join(process.cwd(), "src/features/caja/components/caja/cash-charge-form-section.tsx"),
      "utf8"
    );
    expect(source).toMatch(/PatientSearchCombobox/);
    expect(source).not.toMatch(/filteredPatients\.slice\(0, 80\)/);
  });

  it("adds loading shells for hot dashboard routes", () => {
    expect(readFileSync(join(process.cwd(), "src/app/(dashboard)/pacientes/loading.tsx"), "utf8")).toMatch(
      /PageSkeleton/
    );
    expect(readFileSync(join(process.cwd(), "src/app/(dashboard)/caja/loading.tsx"), "utf8")).toMatch(
      /PageSkeleton/
    );
    expect(readFileSync(join(process.cwd(), "src/app/(dashboard)/pagos/loading.tsx"), "utf8")).toMatch(
      /PageSkeleton/
    );
    expect(
      readFileSync(join(process.cwd(), "src/app/(dashboard)/pacientes/[id]/loading.tsx"), "utf8")
    ).toMatch(/PageSkeleton/);
  });
});
