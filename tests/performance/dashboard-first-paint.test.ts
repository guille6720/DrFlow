import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const root = process.cwd();

function readSrc(relative: string): string {
  return readFileSync(join(root, relative), "utf8");
}

describe("Fase 11 dashboard first paint", () => {
  it("streams clinical ops core before secondary widgets", () => {
    const page = readSrc("src/app/(dashboard)/dashboard/page.tsx");
    expect(page).toMatch(/ClinicalOpsDashboardAsync/);
    expect(page).toMatch(/Suspense/);
    expect(page).not.toMatch(/loadTurnosReportesPageData/);

    const asyncDash = readSrc(
      "src/features/dashboard/components/dashboard/clinical-ops-dashboard-async.tsx"
    );
    expect(asyncDash).toMatch(/loadClinicalOperationsDashboardCore/);
    expect(asyncDash).toMatch(/ClinicalOpsSecondarySections/);
    expect(asyncDash).toMatch(/ClinicalOpsSecondarySkeleton/);

    const core = readSrc(
      "src/features/dashboard/server/load-clinical-operations-dashboard-core.ts"
    );
    expect(core).toMatch(/TODAY_APPOINTMENTS_LIMIT/);
    expect(core).toMatch(/fetchTodayAppointments/);
    expect(core).not.toMatch(/draftRx|pendingStudies|queuedReminders/);

    const secondary = readSrc(
      "src/features/dashboard/server/load-clinical-operations-dashboard-secondary.ts"
    );
    expect(secondary).toMatch(/fetchDashboardSecondaryQueries/);
    expect(secondary).toMatch(/draftPrescriptions/);
  });

  it("exposes quick actions and waiting-room first-paint sections", () => {
    const center = readSrc(
      "src/features/dashboard/components/dashboard/clinical-ops-center/clinical-ops-center.tsx"
    );
    expect(center).toMatch(/ClinicalOpsQuickActions/);
    expect(center).toMatch(/ClinicalOpsMainSectionsCore/);

    const main = readSrc(
      "src/features/dashboard/components/dashboard/clinical-ops-center/clinical-ops-main-sections-core.tsx"
    );
    expect(main).toMatch(/TodayScheduleSection/);
    expect(main).toMatch(/WaitingQueueSection/);
    expect(main).toMatch(/UrgentPatientsSection/);
  });
});
