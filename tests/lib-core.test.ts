import { describe, expect, it } from "vitest";

import {
  backHrefFromClinicalSubpage,
  FROM_CLINICAL_HISTORY,
  isFromClinicalHistory,
  patientClinicalHistoryPath,
  withClinicalHistoryReturn,
} from "@/shared/utils/clinical-navigation";
import { cn } from "@/shared/utils/cn";
import {
  buildWhatsAppShareUrl,
  buildWhatsAppUrl,
  normalizeArgentinaPhone,
} from "@/shared/utils/whatsapp";

import {
  applyPatientSearchFilter,
  buildPostgrestIlikePattern,
  buildPostgrestLastNamePrefixPattern,
  isSingleLetterSearch,
  patientSearchTokens,
  sanitizePatientSearchTerm,
} from "@/features/pacientes/utils/patient-search";

import { normalizeDni } from "@/lib/utils/normalize-dni";

describe("cn", () => {
  it("merges tailwind classes", () => {
    expect(cn("px-2", "px-4", "text-sm")).toBe("px-4 text-sm");
  });
});

describe("clinical-navigation", () => {
  it("builds patient HC path and return query", () => {
    expect(patientClinicalHistoryPath("abc")).toBe("/pacientes/abc?tab=soap");
    expect(withClinicalHistoryReturn("/recetas", "abc")).toContain("from=" + FROM_CLINICAL_HISTORY);
    expect(isFromClinicalHistory(FROM_CLINICAL_HISTORY)).toBe(true);
    expect(backHrefFromClinicalSubpage(FROM_CLINICAL_HISTORY, "abc", "/dashboard")).toBe(
      "/pacientes/abc?tab=soap"
    );
    expect(backHrefFromClinicalSubpage(null, "abc", "/dashboard")).toBe("/dashboard");
  });
});

describe("normalizeDni", () => {
  it("accepts 7-8 digit DNIs", () => {
    expect(normalizeDni("12.345.678")).toBe("12345678");
    expect(normalizeDni("1234567")).toBe("1234567");
  });

  it("trims 9-digit when option set", () => {
    expect(normalizeDni("123456789", { trimNineDigit: true })).toBe("23456789");
  });

  it("rejects invalid lengths", () => {
    expect(normalizeDni("123")).toBeNull();
    expect(normalizeDni("")).toBeNull();
  });
});

describe("whatsapp utils", () => {
  it("normalizes AR mobile numbers", () => {
    expect(normalizeArgentinaPhone("11 2345-6789")).toBe("5491123456789");
    expect(normalizeArgentinaPhone("01123456789")).toMatch(/^54/);
    expect(normalizeArgentinaPhone("5491112345678")).toBe("5491112345678");
    expect(normalizeArgentinaPhone("91112345678")).toMatch(/^54/);
  });

  it("rejects short numbers", () => {
    expect(normalizeArgentinaPhone("123")).toBeNull();
    expect(buildWhatsAppUrl("123", "Hola")).toBeNull();
  });

  it("builds wa.me links", () => {
    const url = buildWhatsAppUrl("11 2345-6789", "Hola");
    expect(url).toContain("wa.me/549");
    expect(url).toContain(encodeURIComponent("Hola"));
    expect(buildWhatsAppShareUrl("Msg")).toContain("wa.me/?text=");
  });
});

describe("patient-search", () => {
  it("sanitizes and tokenizes search terms", () => {
    expect(sanitizePatientSearchTerm("  Juan   Pérez  ")).toBe("Juan Pérez");
    expect(patientSearchTokens("a b  c")).toEqual(["a", "b", "c"]);
  });

  it("builds postgrest ilike patterns with asterisk wildcards", () => {
    expect(buildPostgrestIlikePattern("zap")).toBe("*zap*");
    expect(buildPostgrestIlikePattern("a,b")).toBe("*a\\,b*");
    expect(buildPostgrestLastNamePrefixPattern("z")).toBe("z*");
    expect(buildPostgrestLastNamePrefixPattern("Z")).toBe("Z*");
  });

  it("detects single-letter last name prefix search", () => {
    expect(isSingleLetterSearch("a")).toBe(true);
    expect(isSingleLetterSearch("Z")).toBe(true);
    expect(isSingleLetterSearch("ñ")).toBe(true);
    expect(isSingleLetterSearch("ab")).toBe(false);
    expect(isSingleLetterSearch("1")).toBe(false);
  });

  it("filters last names by prefix when a single letter is entered", () => {
    const calls: string[] = [];
    const query = {
      or(filter: string) {
        calls.push(filter);
        return this;
      },
    };
    applyPatientSearchFilter(query, "z");
    expect(calls).toEqual(["last_name.ilike.z*"]);
  });

  it("applies postgrest or filters per token", () => {
    const calls: string[] = [];
    const query = {
      or(filter: string) {
        calls.push(filter);
        return this;
      },
    };
    applyPatientSearchFilter(query, "Juan 123");
    expect(calls).toHaveLength(2);
    expect(calls[0]).toContain("first_name.ilike.*Juan*");
    expect(calls[0]).not.toContain("%");
    expect(calls[1]).toContain("document_number.ilike.*123*");
  });
});
