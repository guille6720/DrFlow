import { describe, expect, it } from "vitest";

import { canAccessImportExport, canAccessRoute, hasPermission } from "@/core/permissions/roles";

import {
  defaultDuplicateDecisions,
  detectPatientDuplicates,
  resolveDuplicateDecision,
} from "@/features/integraciones/lib/patient-import-duplicates";
import { suggestPatientColumnMapping } from "@/features/integraciones/lib/patient-import-mapping";
import {
  normalizeBirthDate,
  normalizeDocumentNumber,
  normalizeEmail,
  normalizePhone,
} from "@/features/integraciones/lib/patient-import-normalize";
import { mapSpreadsheetRow, validatePatientImportRow } from "@/features/integraciones/lib/patient-import-validate";
import {
  neutralizeSpreadsheetCell,
  toCsvDocument,
} from "@/features/integraciones/lib/spreadsheet-export-safety";

describe("patient import mapping", () => {
  it("suggests DrFlow fields from Spanish headers", () => {
    const mapping = suggestPatientColumnMapping([
      "Documento",
      "Apellido",
      "Nombre",
      "Nacimiento",
      "Celular",
      "Cobertura",
      "Plan",
    ]);
    expect(mapping.document_number).toBe("Documento");
    expect(mapping.last_name).toBe("Apellido");
    expect(mapping.first_name).toBe("Nombre");
    expect(mapping.birth_date).toBe("Nacimiento");
    expect(mapping.phone).toBe("Celular");
    expect(mapping.insurance_provider).toBe("Cobertura");
    expect(mapping.insurance_plan).toBe("Plan");
  });
});

describe("patient import normalization", () => {
  it("normalizes dni, phone, email and dates without inventing data", () => {
    expect(normalizeDocumentNumber("30.123.456")).toBe("30123456");
    expect(normalizePhone("+54 11 5555-1234")).toBe("+541155551234");
    expect(normalizeEmail("  A@B.com ")).toBe("a@b.com");
    expect(normalizeBirthDate("15/01/1990")).toBe("1990-01-15");
    expect(normalizeBirthDate("")).toBeNull();
  });
});

describe("patient import validation", () => {
  it("rejects missing dni and does not default names", () => {
    const mapped = mapSpreadsheetRow(
      { DNI: "", Apellido: "", Nombre: "" },
      { document_number: "DNI", last_name: "Apellido", first_name: "Nombre" },
      4
    );
    const issues = validatePatientImportRow(mapped, { document: "", birthDate: "" });
    expect(issues.some((issue) => issue.code === "empty_row" || issue.code === "missing_dni")).toBe(
      true
    );
    expect(mapped.first_name).toBe("");
  });

  it("flags invalid email and date", () => {
    const mapped = mapSpreadsheetRow(
      { DNI: "30123456", Apellido: "Garcia", Nombre: "Ana", Email: "no-es-mail", Nac: "99/99/99" },
      {
        document_number: "DNI",
        last_name: "Apellido",
        first_name: "Nombre",
        email: "Email",
        birth_date: "Nac",
      },
      5
    );
    const issues = validatePatientImportRow(mapped, { document: "30123456", birthDate: "99/99/99" });
    expect(issues.map((issue) => issue.code)).toEqual(
      expect.arrayContaining(["invalid_email", "invalid_date"])
    );
  });
});

describe("patient duplicate detection", () => {
  it("matches exact document and name+dob separately", () => {
    const incoming = [
      {
        lineNumber: 2,
        document_number: "30123456",
        last_name: "Perez",
        first_name: "Juan",
        birth_date: "1980-01-01",
        phone: null,
        email: null,
        address: null,
        insurance_provider: "OSDE",
        insurance_plan: null,
        insurance_number: null,
        emergency_contact_name: null,
        emergency_contact_phone: null,
      },
      {
        lineNumber: 3,
        document_number: "40111222",
        last_name: "Lopez",
        first_name: "Ana",
        birth_date: "1990-02-02",
        phone: null,
        email: null,
        address: null,
        insurance_provider: null,
        insurance_plan: null,
        insurance_number: null,
        emergency_contact_name: null,
        emergency_contact_phone: null,
      },
    ];
    const existing = [
      {
        id: "a",
        first_name: "Juan",
        last_name: "Perez",
        document_number: "30123456",
        birth_date: "1980-01-01",
        phone: "11",
        email: null,
        insurance_provider: null,
        insurance_plan: null,
      },
      {
        id: "b",
        first_name: "Ana",
        last_name: "Lopez",
        document_number: "99999999",
        birth_date: "1990-02-02",
        phone: null,
        email: null,
        insurance_provider: null,
        insurance_plan: null,
      },
    ];
    const found = detectPatientDuplicates(incoming, existing);
    expect(found[0]?.matchType).toBe("document");
    expect(found[1]?.matchType).toBe("name_dob");
  });

  it("defaults exact duplicates to keep existing", () => {
    const decisions = defaultDuplicateDecisions();
    expect(resolveDuplicateDecision(decisions, 2, "document")).toBe("keep");
    expect(resolveDuplicateDecision(decisions, 3, "name_dob")).toBe("review");
  });
});

describe("csv injection", () => {
  it("prefixes formula-like cells", () => {
    expect(neutralizeSpreadsheetCell("=CMD")).toBe("'=CMD");
    expect(neutralizeSpreadsheetCell("+1")).toBe("'+1");
    expect(neutralizeSpreadsheetCell("Perez")).toBe("Perez");
    expect(toCsvDocument([["=1+1"]])).toContain("'=1+1");
  });
});

describe("import/export permissions", () => {
  it("lets secretary import patients but not clinical records", () => {
    expect(hasPermission("secretary", "importPatients")).toBe(true);
    expect(hasPermission("secretary", "importClinicalRecords")).toBe(false);
    expect(hasPermission("secretary", "bulkExportData")).toBe(false);
    expect(canAccessRoute("secretary", "/datos")).toBe(true);
    expect(canAccessImportExport("secretary")).toBe(true);
  });

  it("blocks patient role from /datos", () => {
    expect(canAccessRoute("patient", "/datos")).toBe(false);
    expect(canAccessImportExport("patient")).toBe(false);
  });

  it("allows clinic admin bulk export", () => {
    expect(hasPermission("clinic_admin", "bulkExportData")).toBe(true);
    expect(canAccessRoute("clinic_admin", "/datos")).toBe(true);
  });
});
