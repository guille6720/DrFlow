import { describe, expect, it } from "vitest";
import { cn } from "@/lib/utils/cn";
import {
  backHrefFromClinicalSubpage,
  FROM_CLINICAL_HISTORY,
  isFromClinicalHistory,
  patientClinicalHistoryPath,
  withClinicalHistoryReturn,
} from "@/lib/utils/clinical-navigation";
import { normalizeDni } from "@/lib/utils/normalize-dni";
import {
  buildWhatsAppShareUrl,
  buildWhatsAppUrl,
  normalizeArgentinaPhone,
} from "@/lib/utils/whatsapp";
import {
  applyPatientSearchFilter,
  patientSearchTokens,
  sanitizePatientSearchTerm,
} from "@/lib/utils/patient-search";

describe("cn", () => {
  it("merges tailwind classes", () => {
    expect(cn("px-2", "px-4", "text-sm")).toBe("px-4 text-sm");
  });
});

describe("clinical-navigation", () => {
  it("builds patient HC path and return query", () => {
    expect(patientClinicalHistoryPath("abc")).toBe("/pacientes/abc?tab=evoluciones");
    expect(withClinicalHistoryReturn("/recetas", "abc")).toContain("from=" + FROM_CLINICAL_HISTORY);
    expect(isFromClinicalHistory(FROM_CLINICAL_HISTORY)).toBe(true);
    expect(backHrefFromClinicalSubpage(FROM_CLINICAL_HISTORY, "abc", "/dashboard")).toBe(
      "/pacientes/abc?tab=evoluciones"
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
    expect(calls[0]).toContain("first_name.ilike");
  });
});
