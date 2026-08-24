import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { PATIENT_EHR_PRINT_MAX_RECORDS } from "@/features/pacientes/server/load-patient-ehr-data";

describe("loadPatientClinicalRecordsForPrint", () => {
  it("keeps a dedicated print cap above the soap first-paint limit", () => {
    expect(PATIENT_EHR_PRINT_MAX_RECORDS).toBe(2000);
    expect(PATIENT_EHR_PRINT_MAX_RECORDS).toBeGreaterThan(20);
  });

  it("exports a server action that fetches full history for print", () => {
    const source = readFileSync(
      join(process.cwd(), "src/features/pacientes/server/load-patient-clinical-records-for-print.ts"),
      "utf8"
    );
    expect(source).toMatch(/PATIENT_EHR_PRINT_MAX_RECORDS/);
    expect(source).toMatch(/includeHceStructural:\s*true/);
    expect(source).toMatch(/export async function loadPatientClinicalRecordsForPrint/);
  });

  it("wires full-history fetch into EHR print trigger when pagination has more", () => {
    const hook = readFileSync(
      join(process.cwd(), "src/features/pacientes/hooks/use-patient-ehr-state.ts"),
      "utf8"
    );
    expect(hook).toMatch(/loadPatientClinicalRecordsForPrint/);
    expect(hook).toMatch(/recordsPagination\.hasMore/);
    expect(hook).toMatch(/printingFullHistory/);
  });
});
