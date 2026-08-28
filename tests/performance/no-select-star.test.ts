import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { PRESCRIPTION_ISSUE_COLUMNS } from "@/features/recetas/repositories/prescription-drafts.repository";

const root = process.cwd();

function readSrc(relative: string): string {
  return readFileSync(join(root, relative), "utf8");
}

describe("critical tables avoid SELECT * returning", () => {
  const files = [
    "src/features/pacientes/repositories/patients.repository.ts",
    "src/features/recetas/repositories/prescription-drafts.repository.ts",
    "src/features/recetas/repositories/medical-orders.repository.ts",
    "src/lib/actions/appointments.ts",
    "src/features/historias/services/clinical-records.service.ts",
    "src/features/integraciones/actions/patient-import-session.ts",
    "src/features/integraciones/actions/fhir-import-session.ts",
    "src/core/billing/subscription-service.ts",
    "src/lib/actions/admin-documents.ts",
    "src/lib/actions/cash-register.ts",
    "src/lib/actions/clinic-services.ts",
  ];

  it.each(files)("does not use wildcard or empty .select() in %s", (file) => {
    const src = readSrc(file);
    expect(src).not.toMatch(/\.select\(\s*["']\*["']\s*\)/);
    expect(src).not.toMatch(/\.select\(\)/);
  });

  it("prescription issue columns cover the ElectronicPrescription row", () => {
    expect(PRESCRIPTION_ISSUE_COLUMNS).not.toContain("*");
    for (const column of ["id", "medications", "dispensed_at", "created_at", "version"]) {
      expect(PRESCRIPTION_ISSUE_COLUMNS).toContain(column);
    }
  });
});
