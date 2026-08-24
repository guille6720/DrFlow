import { describe, expect, it } from "vitest";

import { validateJsonImportUpload } from "@/core/security/file-upload";
import {
  FHIR_DNI_SYSTEM,
  mapClinicalSnapshotToFhirBundle,
  parseFhirImportDraft,
  parseFhirJson,
  splitBundleByType,
} from "@/core/services/interoperability/fhir";

import type { ClinicalExportSnapshot } from "@/features/integraciones/lib/clinical-export-package";
import { ALL_CLINICAL_EXPORT_SECTIONS } from "@/features/integraciones/lib/clinical-export-sections";
import { prepareFhirImportFromText } from "@/features/integraciones/server/prepare-fhir-import";

function mockFile(name: string, type: string, size: number): File {
  return { name, type, size } as File;
}

const snapshot: ClinicalExportSnapshot = {
  exported_at: "2026-08-17T12:00:00.000Z",
  patient: {
    document_number: "30123456",
    last_name: "Garcia",
    first_name: "Ana",
    birth_date: "1990-01-15",
    phone: "+541155551234",
    email: "ana@example.com",
    address: "Calle 1",
    insurance_provider: "OSDE",
    insurance_plan: null,
    insurance_number: "123",
    emergency_contact_name: null,
    emergency_contact_phone: null,
  },
  medical_history: "Asma",
  allergies: "Penicilina",
  regular_medication: "Salbutamol",
  consultations: [
    {
      local_key: "c1",
      date: "2026-01-10T10:00:00.000Z",
      professional_name: "Dra. Lopez",
      chief_complaint: "Control",
      diagnosis: "Asma",
      evolution: "Estable",
      indications: "Continuar",
    },
  ],
  diagnoses: [{ date: "2026-01-10T10:00:00.000Z", name: "Asma", chronic: true, cie10: "J45" }],
  medications: [],
  prescriptions: [],
  orders: [],
  attachments: [
    { file_name: "rx.pdf", category: "estudio", created_at: "2026-01-11", document_date: null, source: null },
  ],
  warnings: [],
};

describe("FHIR R4 mapping", () => {
  it("maps a clinical snapshot to a collection Bundle without internal UUIDs", () => {
    const bundle = mapClinicalSnapshotToFhirBundle(snapshot, ALL_CLINICAL_EXPORT_SECTIONS);
    expect(bundle.resourceType).toBe("Bundle");
    expect(bundle.type).toBe("collection");
    const types = (bundle.entry ?? []).map((item) => item.resource.resourceType);
    expect(types).toEqual(
      expect.arrayContaining([
        "Patient",
        "Practitioner",
        "Encounter",
        "Condition",
        "AllergyIntolerance",
        "Observation",
        "DiagnosticReport",
      ])
    );
    const patient = bundle.entry?.find((item) => item.resource.resourceType === "Patient")?.resource;
    const identifiers = (patient?.identifier as Array<{ system?: string; value?: string }>) ?? [];
    expect(identifiers[0]?.system).toBe(FHIR_DNI_SYSTEM);
    expect(identifiers[0]?.value).toBe("30123456");
    expect(JSON.stringify(bundle)).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-/);
    expect(splitBundleByType(bundle).Encounter?.total).toBe(1);
  });
});

describe("FHIR R4 parse", () => {
  it("round-trips DNI demographics and encounters", () => {
    const bundle = mapClinicalSnapshotToFhirBundle(snapshot, ALL_CLINICAL_EXPORT_SECTIONS);
    const draft = parseFhirImportDraft(bundle);
    expect(draft.patients).toHaveLength(1);
    expect(draft.patients[0]?.demographics.document_number).toBe("30123456");
    expect(draft.patients[0]?.demographics.last_name).toBe("Garcia");
    expect(draft.patients[0]?.encounters.length).toBeGreaterThan(0);
    expect(draft.patients[0]?.allergies).toContain("Penicilina");
  });

  it("rejects a Patient without DNI instead of inventing one", () => {
    const parsed = parseFhirJson(
      JSON.stringify({
        resourceType: "Patient",
        name: [{ family: "Perez", given: ["Juan"] }],
      })
    );
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const draft = parseFhirImportDraft(parsed.bundle);
    expect(draft.patients).toHaveLength(0);
    expect(draft.issues[0]).toMatch(/DNI/);
  });

  it("caps oversized bundles at prepare time", () => {
    const huge = {
      resourceType: "Bundle",
      type: "collection",
      entry: Array.from({ length: 501 }, (_, index) => ({
        resource: { resourceType: "Observation", id: `obs-${index}` },
      })),
    };
    const prepared = prepareFhirImportFromText(JSON.stringify(huge));
    expect(prepared.ok).toBe(false);
  });
});

describe("FHIR JSON upload", () => {
  it("accepts text JSON and rejects binary", () => {
    const json = Buffer.from('{"resourceType":"Patient"}');
    const file = mockFile("bundle.json", "application/json", json.length);
    expect(validateJsonImportUpload(file, json, 1024 * 1024).ok).toBe(true);
    expect(validateJsonImportUpload(file, Buffer.from([0x00, 0x01]), 1024 * 1024).ok).toBe(false);
  });
});
