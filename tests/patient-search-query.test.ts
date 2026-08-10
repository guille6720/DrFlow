import { describe, expect, it } from "vitest";

import {
  extractPatientSearchDigits,
  isPatientDocumentSearchQuery,
  PATIENT_SEARCH_MIN_TEXT_LENGTH,
  resolvePatientSearchMinLength,
  shouldExecutePatientSearch,
  validatePatientSearchQuery,
} from "@/features/pacientes/utils/patient-search-query";

describe("patient-search-query", () => {
  it("detects document-only queries", () => {
    expect(isPatientDocumentSearchQuery("12.345.678")).toBe(true);
    expect(isPatientDocumentSearchQuery("Juan")).toBe(false);
  });

  it("allows shorter queries for DNI and single-letter prefix", () => {
    expect(resolvePatientSearchMinLength("3")).toBe(1);
    expect(resolvePatientSearchMinLength("z")).toBe(1);
    expect(resolvePatientSearchMinLength("Ju")).toBe(PATIENT_SEARCH_MIN_TEXT_LENGTH);
  });

  it("skips search below minimum text length", () => {
    expect(shouldExecutePatientSearch("J")).toBe(true);
    expect(shouldExecutePatientSearch("a")).toBe(true);
    expect(shouldExecutePatientSearch("@")).toBe(false);
    expect(shouldExecutePatientSearch("12")).toBe(true);
    expect(shouldExecutePatientSearch("ab")).toBe(true);
  });

  it("extracts digits for document matching", () => {
    expect(extractPatientSearchDigits("12.345.678")).toBe("12345678");
  });

  it("validates server queries", () => {
    expect(validatePatientSearchQuery("  Juan  ")).toEqual({ ok: true, q: "Juan" });
    expect(validatePatientSearchQuery("a")).toEqual({ ok: true, q: "a" });
    expect(validatePatientSearchQuery("")).toEqual({ ok: false });
  });
});
