import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

function readSrc(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8");
}

describe("security actions audit — batch import isolation", () => {
  it("consumers batch processor is not a Server Action export", () => {
    const batch = readSrc("src/features/pacientes/server/consumers-import-batch.ts");
    expect(batch).not.toMatch(/"use server"/);
    expect(batch).toContain("processConsumersImportBatchFromBuffer");

    const action = readSrc("src/lib/actions/patient-import.ts");
    expect(action).toMatch(/"use server"/);
    expect(action).not.toMatch(/export async function processConsumersImportBatchFromBuffer/);
    expect(action).toContain('from "@/features/pacientes/server/consumers-import-batch"');
  });

  it("HCE batch processor is not a Server Action export", () => {
    const batch = readSrc("src/features/integraciones/server/hce-import-batch.ts");
    expect(batch).not.toMatch(/"use server"/);
    expect(batch).toContain("processHceImportBatchFromContent");

    const action = readSrc("src/lib/actions/hce-import.ts");
    expect(action).toMatch(/"use server"/);
    expect(action).not.toMatch(/export async function processHceImportBatchFromContent/);
    expect(action).toContain('from "@/features/integraciones/server/hce-import-batch"');
  });

  it("job handler imports batch processors from internal server modules", () => {
    const handler = readSrc("src/core/jobs/handlers/import-batch.ts");
    expect(handler).toContain('from "@/features/integraciones/server/hce-import-batch"');
    expect(handler).toContain('from "@/features/pacientes/server/consumers-import-batch"');
    expect(handler).not.toContain('from "@/lib/actions/hce-import"');
    expect(handler).not.toContain('from "@/lib/actions/patient-import"');
  });
});

describe("security actions audit — explicit authorization guards", () => {
  it("applyClinicLegalAcceptance validates session, membership and role", () => {
    const src = readSrc("src/lib/actions/compliance.ts");
    expect(src).toMatch(/applyClinicLegalAcceptance[\s\S]*getSession\(\)/);
    expect(src).toMatch(/clinic_members/);
    expect(src).toMatch(/manageSettings|clinic_admin/);
    expect(src).toContain("applyClinicLegalAcceptanceInternal");
  });

  it("purgeSoleOwnerClinicsForUser enforces self-ownership", () => {
    const src = readSrc("src/lib/actions/clinic-purge.ts");
    expect(src).toMatch(/getSession\(\)/);
    expect(src).toMatch(/user\.id !== idParsed\.data/);
    expect(src).toContain("purgeSoleOwnerClinicsForUserInternal");
  });

  it("doctor profile actions require doctor or clinic_admin role", () => {
    const src = readSrc("src/lib/actions/doctor-profile.ts");
    expect(src).toContain("requireDoctorProfileAccess");
    expect(src).toMatch(/role === "doctor"/);
    expect(src).toMatch(/role === "clinic_admin"/);
  });

  it("command palette patients API returns 401 without session", () => {
    const src = readSrc("src/app/api/command-palette/patients/route.ts");
    expect(src).toMatch(/getSession\(\)/);
    expect(src).toMatch(/401/);
    expect(src).toMatch(/managePatients|viewClinicalRecords/);
  });
});
