import { describe, expect, it } from "vitest";

import {
  ageYearsFromBirthDate,
  anonymizeClinicalText,
} from "@/lib/ai/anonymize-clinical-context";

describe("anonymizeClinicalText", () => {
  it("redacts names, DNI, email and phone", () => {
    const text = anonymizeClinicalText(
      "Ana García DNI 30123456 email ana@mail.com tel 1155550001. Control HTA.",
      ["Ana García"]
    );

    expect(text).not.toContain("Ana García");
    expect(text).toContain("[REDACTADO]");
    expect(text).toContain("[DNI]");
    expect(text).toContain("[EMAIL]");
    expect(text).toContain("[TEL]");
    expect(text).toContain("Control HTA");
  });
});

describe("ageYearsFromBirthDate", () => {
  it("computes age without exposing the birth date", () => {
    expect(ageYearsFromBirthDate("1990-01-01", new Date("2026-08-12"))).toBe(36);
  });
});
