import { describe, expect, it } from "vitest";

import {
  CLINICAL_TEMPLATE_PASTE_FORMAT,
  parseClinicalTemplatePaste,
  resolveSpecialtyIdFromPaste,
} from "@/lib/utils/parse-clinical-template-paste";

describe("parseClinicalTemplatePaste", () => {
  it("parses section headers with multiline bodies", () => {
    const parsed = parseClinicalTemplatePaste(CLINICAL_TEMPLATE_PASTE_FORMAT);

    expect(parsed.name).toBe("Control HTA");
    expect(parsed.chief_complaint_template).toContain("hipertensión");
    expect(parsed.diagnosis_template).toContain("I10");
    expect(parsed.evolution_template).toContain("PA:");
    expect(parsed.indications_template).toContain("Dieta hiposódica");
  });

  it("parses inline header values", () => {
    const parsed = parseClinicalTemplatePaste(`Nombre: Control diabetes
Especialidad: Clínica médica

Evolución:
Paciente estable.`);

    expect(parsed.name).toBe("Control diabetes");
    expect(parsed.specialty).toBe("Clínica médica");
    expect(parsed.evolution_template).toContain("Paciente estable");
  });

  it("parses JSON payloads", () => {
    const parsed = parseClinicalTemplatePaste(
      JSON.stringify({
        name: "JSON plantilla",
        chief_complaint: "Dolor torácico",
        evolution: "Sin alarma.",
        indications: "ECG y troponinas.",
      })
    );

    expect(parsed.name).toBe("JSON plantilla");
    expect(parsed.chief_complaint_template).toBe("Dolor torácico");
    expect(parsed.evolution_template).toBe("Sin alarma.");
    expect(parsed.indications_template).toBe("ECG y troponinas.");
  });

  it("uses free text as evolution when no headers are present", () => {
    const parsed = parseClinicalTemplatePaste("Paciente refiere cefalea holocraneana.");

    expect(parsed.evolution_template).toContain("cefalea");
    expect(parsed.name.length).toBeGreaterThan(0);
  });
});

describe("resolveSpecialtyIdFromPaste", () => {
  const specialties = [
    { id: "sp-1", name: "Clínica médica" },
    { id: "sp-2", name: "Cardiología" },
  ];

  it("matches specialty by normalized name", () => {
    expect(resolveSpecialtyIdFromPaste("clinica medica", specialties)).toBe("sp-1");
    expect(resolveSpecialtyIdFromPaste("Cardiología", specialties)).toBe("sp-2");
  });
});
