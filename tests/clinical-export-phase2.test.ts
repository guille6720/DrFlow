import { readFileSync } from "fs";
import { resolve } from "path";
import { describe, expect, it } from "vitest";

import {
  buildClinicalExportDocument,
  type ClinicalExportSnapshot,
} from "@/features/integraciones/lib/clinical-export-package";
import {
  inExportDateRange,
  parseClinicalExportSections,
  parseExportDateRange,
} from "@/features/integraciones/lib/clinical-export-sections";
import {
  pickCompatibleTemplate,
  remapTemplateToHeaders,
  scoreMappingAgainstHeaders,
} from "@/features/integraciones/lib/patient-import-mapping";
import { buildZipStore, crc32 } from "@/features/integraciones/lib/zip-store";

const snapshot: ClinicalExportSnapshot = {
  exported_at: "2026-08-17T12:00:00.000Z",
  patient: {
    document_number: "30123456",
    last_name: "Garcia",
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
  medications: [
    {
      date: "2026-01-10T10:00:00.000Z",
      product: "Salbutamol",
      dose: "2 puff",
      frequency: "SOS",
      notes: "",
      status: "Actual",
    },
  ],
  prescriptions: [],
  orders: [],
  attachments: [{ file_name: "rx.pdf", category: "estudio", created_at: "2026-01-11", document_date: null, source: null }],
  warnings: [],
};

describe("import mapping templates", () => {
  it("scores and picks a compatible saved template", () => {
    const headers = ["DNI", "Apellido", "Nombre", "Celular"];
    const mapping = { document_number: "DNI", last_name: "Apellido", first_name: "Nombre", phone: "Celular" };
    expect(scoreMappingAgainstHeaders(mapping, headers)).toBe(1);
    const picked = pickCompatibleTemplate(
      [
        { id: "1", name: "PAMI", mapping, date_format: "dmy", last_used_at: "2026-01-01" },
        {
          id: "2",
          name: "Otra",
          mapping: { document_number: "Documento", last_name: "Apellido", first_name: "Nombre" },
          date_format: "dmy",
          last_used_at: "2026-08-01",
        },
      ],
      headers
    );
    expect(picked?.name).toBe("PAMI");
    expect(remapTemplateToHeaders(mapping, ["dni", "apellido", "nombre"])).toEqual({
      document_number: "dni",
      last_name: "apellido",
      first_name: "nombre",
    });
  });

  it("does not auto-apply when required columns are missing", () => {
    const picked = pickCompatibleTemplate(
      [
        {
          id: "1",
          name: "Incompleta",
          mapping: { document_number: "DNI", last_name: "Apellido", first_name: "Nombre" },
          date_format: null,
        },
      ],
      ["Apellido", "Nombre"]
    );
    expect(picked).toBeNull();
  });
});

describe("clinical export package", () => {
  it("omits unselected sections and internal ids", () => {
    const document = buildClinicalExportDocument(snapshot, ["demographics", "allergies"]);
    expect(document.patient).toMatchObject({ document_number: "30123456", last_name: "Garcia" });
    expect(document).not.toHaveProperty("consultations");
    expect(JSON.stringify(document)).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-/);
  });

  it("filters dates inclusively", () => {
    expect(inExportDateRange("2026-03-01T12:00:00Z", "2026-03-01", "2026-03-31")).toBe(true);
    expect(inExportDateRange("2026-02-28", "2026-03-01", null)).toBe(false);
    expect(parseExportDateRange("2026-03-10", "2026-03-01").ok).toBe(false);
    expect(parseClinicalExportSections(["consultations", "nope"])).toEqual(["consultations"]);
  });
});

describe("zip store", () => {
  it("writes a readable STORE archive with crc", () => {
    const payload = Buffer.from("hola", "utf8");
    const zip = buildZipStore([
      { name: "Data/hello.txt", data: payload },
      { name: "../escape.txt", data: Buffer.from("x") },
    ]);
    expect(zip.subarray(0, 4).toString("hex")).toBe("504b0304");
    expect(zip.includes(Buffer.from("Data/hello.txt"))).toBe(true);
    expect(zip.includes(Buffer.from("../escape"))).toBe(false);
    expect(crc32(payload)).toBeGreaterThan(0);
  });
});

describe("historical documents import", () => {
  it("does not call PDF-to-SOAP extraction", () => {
    const src = readFileSync(
      resolve(process.cwd(), "src/features/integraciones/actions/historical-documents-import.ts"),
      "utf8"
    );
    expect(src).toMatch(/validateAdminDocumentUpload/);
    expect(src).not.toMatch(/processClinicalPdfImport/);
  });
});
