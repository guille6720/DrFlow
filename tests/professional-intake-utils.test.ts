import { describe, expect, it } from "vitest";
import { getProfessionalSpecialtyDefaults } from "@/components/profesionales/professional-intake-utils";
import type { ProfessionalIntakeDetail } from "@/components/profesionales/professional-intake-types";
import { SPECIALTY_OTHER_VALUE } from "@/lib/constants/medical-specialties";
describe("getProfessionalSpecialtyDefaults", () => {
  it("maps listed specialty to select value", () => {
    const selected = {
      id: "1",
      display_name: "García, Juan",
      specialties: { name: "Cardiología" },
    } as ProfessionalIntakeDetail;

    const result = getProfessionalSpecialtyDefaults(selected);
    expect(result.specialtySelect).toBe("Cardiología");
    expect(result.specialtyCustom).toBe("");
  });

  it("maps custom specialty to other + custom field", () => {
    const selected = {
      id: "1",
      display_name: "García, Juan",
      specialties: { name: "Medicina del deporte" },
    } as ProfessionalIntakeDetail;

    const result = getProfessionalSpecialtyDefaults(selected);
    expect(result.specialtySelect).toBe(SPECIALTY_OTHER_VALUE);
    expect(result.specialtyCustom).toBe("Medicina del deporte");
  });
});
