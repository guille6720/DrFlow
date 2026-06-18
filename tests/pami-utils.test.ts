import { describe, expect, it } from "vitest";
import { calculateAge, formatAgeLabel, isPamiPatient } from "@/lib/utils/patient-age";
import { buildWhatsAppUrl, normalizeArgentinaPhone } from "@/lib/utils/whatsapp";

describe("patient-age", () => {
  it("calculates age from birth date", () => {
    const birth = `${new Date().getFullYear() - 70}-01-15`;
    expect(calculateAge(birth)).toBe(70);
  });

  it("formats age label", () => {
    const birth = `${new Date().getFullYear() - 80}-06-01`;
    expect(formatAgeLabel(birth)).toBe("80 años");
  });

  it("detects PAMI coverage", () => {
    expect(isPamiPatient("PAMI")).toBe(true);
    expect(isPamiPatient("pami")).toBe(true);
    expect(isPamiPatient("OSDE")).toBe(false);
  });
});

describe("whatsapp", () => {
  it("normalizes Argentine mobile", () => {
    expect(normalizeArgentinaPhone("11 5555-1234")).toBe("5491155551234");
  });

  it("builds wa.me link", () => {
    const url = buildWhatsAppUrl("11 5555-1234", "Hola paciente PAMI");
    expect(url).toContain("https://wa.me/5491155551234");
    expect(url).toContain(encodeURIComponent("Hola paciente PAMI"));
  });
});
