import { describe, expect, it } from "vitest";

import {
  buildCreatePatientHref,
  buildReturnPathWithPatient,
  parsePatientSearchQueryForPrefill,
} from "@/features/pacientes/utils/create-patient-from-search";

describe("create-patient-from-search", () => {
  it("parses DNI-only query", () => {
    expect(parsePatientSearchQueryForPrefill("30123456")).toEqual({
      document_number: "30123456",
    });
  });

  it("parses apellido, nombre", () => {
    expect(parsePatientSearchQueryForPrefill("García, Juan")).toEqual({
      last_name: "García",
      first_name: "Juan",
    });
  });

  it("parses two-word name as apellido + nombre", () => {
    expect(parsePatientSearchQueryForPrefill("Lopez Maria")).toEqual({
      last_name: "Lopez",
      first_name: "Maria",
    });
  });

  it("builds create patient href with query and return path", () => {
    expect(buildCreatePatientHref("Lopez", "/agenda?action=new")).toBe(
      "/pacientes/nuevo?q=Lopez&return=%2Fagenda%3Faction%3Dnew"
    );
  });

  it("appends patient id to return path", () => {
    expect(buildReturnPathWithPatient("/turnos/nuevo", "pat-123")).toBe(
      "/turnos/nuevo?patient=pat-123"
    );
    expect(buildReturnPathWithPatient("/turnos/nuevo?professional=pro-1", "pat-123")).toBe(
      "/turnos/nuevo?professional=pro-1&patient=pat-123"
    );
  });
});
