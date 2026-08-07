import { describe, expect, it } from "vitest";

import { normalizePatientSearchResult } from "@/features/pacientes/utils/patient-search-result";

describe("normalizePatientSearchResult", () => {
  it("keeps picker rows as-is", () => {
    expect(
      normalizePatientSearchResult({
        id: "p1",
        first_name: "Juan",
        last_name: "García",
        document_number: "30123456",
        phone: "1122334455",
        insurance_provider: "PAMI",
      })
    ).toEqual({
      id: "p1",
      first_name: "Juan",
      last_name: "García",
      document_number: "30123456",
      phone: "1122334455",
      insurance_provider: "PAMI",
    });
  });

  it("maps command palette hits to picker rows", () => {
    expect(
      normalizePatientSearchResult({
        id: "p2",
        first_name: "",
        last_name: "",
        document_number: "",
        label: "Zakrzewski, Anabella Jazmin",
        description: "DNI 95954058",
      })
    ).toEqual({
      id: "p2",
      first_name: "Anabella Jazmin",
      last_name: "Zakrzewski",
      document_number: "95954058",
      birth_date: undefined,
      phone: undefined,
      insurance_provider: undefined,
    });
  });
});
