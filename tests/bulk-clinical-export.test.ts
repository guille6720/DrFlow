import { describe, expect, it } from "vitest";

import { mapClinicalSnapshotToFhirBundle, mergeFhirPatientBundles } from "@/core/services/interoperability/fhir";
import { validateClinicJobEnqueue } from "@/core/validations/clinic-jobs";

import {
  bulkExportPatientCap,
  flattenBulkExportSheets,
  parseBulkClinicalExportFilters,
  parseBulkClinicalExportRequest,
} from "@/features/integraciones/lib/bulk-clinical-export";
import type { ClinicalExportSnapshot } from "@/features/integraciones/lib/clinical-export-package";

const snapshot = (dni: string, last: string): ClinicalExportSnapshot => ({
  exported_at: "2026-08-17T12:00:00.000Z",
  patient: {
    document_number: dni,
    last_name: last,
    first_name: "Ana",
    birth_date: "1990-01-15",
    phone: null,
    email: null,
    address: null,
    insurance_provider: "OSDE",
    insurance_plan: null,
    insurance_number: null,
    emergency_contact_name: null,
    emergency_contact_phone: null,
  },
  medical_history: null,
  allergies: null,
  regular_medication: null,
  consultations: [
    {
      local_key: "c1",
      date: "2026-01-10T10:00:00.000Z",
      professional_name: "Dra. Lopez",
      chief_complaint: "=HYPERLINK(1)",
      diagnosis: "Asma",
      evolution: "Estable",
      indications: "Continuar",
    },
  ],
  diagnoses: [],
  medications: [],
  prescriptions: [],
  orders: [],
  attachments: [],
  warnings: [],
});

describe("bulk clinical export parsing", () => {
  it("requires confirmation before write", () => {
    const filters = parseBulkClinicalExportFilters({
      format: "json",
      scope: "all",
      sections: ["demographics"],
    });
    expect(filters.ok).toBe(true);
    const blocked = parseBulkClinicalExportRequest({
      format: "json",
      scope: "all",
      sections: ["demographics"],
    });
    expect(blocked.ok).toBe(false);
  });

  it("requires selected patients when scope is selected", () => {
    const parsed = parseBulkClinicalExportFilters({
      format: "csv",
      scope: "selected",
      patientIds: [],
      sections: ["demographics"],
    });
    expect(parsed.ok).toBe(false);
  });

  it("caps zip tighter than demographics csv", () => {
    expect(bulkExportPatientCap("csv", ["demographics"])).toBe(5000);
    expect(bulkExportPatientCap("zip", ["demographics", "consultations"])).toBe(25);
    expect(bulkExportPatientCap("fhir", ["demographics"])).toBe(100);
  });
});

describe("bulk clinical export spreadsheets", () => {
  it("neutralizes formula cells and keys rows by DNI", () => {
    const sheets = flattenBulkExportSheets([snapshot("30123456", "Garcia")], ["demographics", "consultations"]);
    expect(sheets.consultas[1][0]).toBe("30123456");
    expect(sheets.consultas[1][3]).toBe("'=HYPERLINK(1)");
  });
});

describe("bulk FHIR merge", () => {
  it("prefixes resource ids so two patients do not collide", () => {
    const a = mapClinicalSnapshotToFhirBundle(snapshot("30123456", "Garcia"), ["demographics"]);
    const b = mapClinicalSnapshotToFhirBundle(snapshot("40123456", "Perez"), ["demographics"]);
    const merged = mergeFhirPatientBundles([a, b]);
    const ids = (merged.entry ?? []).map((item) => item.resource.id);
    expect(ids).toContain("p1-patient-1");
    expect(ids).toContain("p2-patient-1");
  });
});

describe("bulk export job payload", () => {
  it("rejects an unconfirmed bulk export job", () => {
    const result = validateClinicJobEnqueue("export_clinical_bulk", {
      userId: "550e8400-e29b-41d4-a716-446655440000",
      format: "csv",
      scope: "all",
      patientIds: [],
      sections: ["demographics"],
      dateFrom: null,
      dateTo: null,
      professionalId: null,
      insuranceProvider: null,
      confirmed: false,
    });
    expect(result.ok).toBe(false);
  });
});
