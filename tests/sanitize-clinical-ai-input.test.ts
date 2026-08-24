import { describe, expect, it } from "vitest";

import {
  anonymizeClinicStatsPatientNames,
  hasResidualClinicalPii,
  sanitizeClinicalAIChatMessages,
  sanitizeClinicalAIInput,
} from "@/lib/ai/sanitize-clinical-ai-input";

describe("sanitizeClinicalAIInput", () => {
  it("redacts Argentine DNI with dots", () => {
    const result = sanitizeClinicalAIInput(
      "Analiza el caso de Juan Pérez DNI 12.345.678 con HTA.",
      { knownIdentifiers: ["Juan Pérez"] }
    );
    expect(result.blocked).toBe(false);
    expect(result.sanitized).not.toContain("Juan Pérez");
    expect(result.sanitized).not.toContain("12.345.678");
    expect(result.sanitized).toContain("[DNI]");
    expect(result.status).toBe("partial");
  });

  it("redacts CUIT/CUIL formats", () => {
    const result = sanitizeClinicalAIInput("Profesional CUIT 20-12345678-3 y paciente CUIL 27-34567890-1");
    expect(result.blocked).toBe(false);
    expect(result.sanitized).not.toMatch(/20-12345678-3/);
    expect(result.sanitized).not.toMatch(/27-34567890-1/);
    expect(result.sanitized).toContain("[CUIT/CUIL]");
  });

  it("redacts email and Argentine phone", () => {
    const result = sanitizeClinicalAIInput(
      "Contactar a maria@ejemplo.com.ar o al 11 5555-0001"
    );
    expect(result.blocked).toBe(false);
    expect(result.sanitized).toContain("[EMAIL]");
    expect(result.sanitized).toContain("[TEL]");
  });

  it("blocks when residual identifier patterns remain after redaction", () => {
    const clean = sanitizeClinicalAIInput("texto con DNI 30123456", {
      failOnResidualPii: true,
      knownIdentifiers: [],
    });
    expect(clean.blocked).toBe(false);
    expect(clean.sanitized).toContain("[DNI]");

    expect(hasResidualClinicalPii("contacto admin@clinic.com")).toBe(true);
    expect(hasResidualClinicalPii("evolución HTA estable [DNI]")).toBe(false);
  });

  it("allows clinical content without identifiers", () => {
    const result = sanitizeClinicalAIInput("Paciente con HTA controlada, TA 130/80, sin alergias.");
    expect(result.blocked).toBe(false);
    expect(result.status).toBe("ok");
    expect(result.sanitized).toContain("HTA controlada");
  });
});

describe("sanitizeClinicalAIChatMessages", () => {
  it("sanitizes each message in history", () => {
    const { messages, blocked } = sanitizeClinicalAIChatMessages([
      { role: "user", content: "Resumen de María López DNI 28456789" },
      { role: "assistant", content: "Control de diabetes tipo 2" },
    ], { knownIdentifiers: ["María López"] });

    expect(blocked).toBe(false);
    expect(messages[0]?.content).not.toContain("María López");
    expect(messages[0]?.content).toContain("[DNI]");
    expect(messages[1]?.content).toContain("diabetes");
  });
});

describe("anonymizeClinicStatsPatientNames", () => {
  it("tokenizes patient names for AI context", () => {
    const rows = anonymizeClinicStatsPatientNames([
      { name: "García, Ana", date: "2026-01-15", diagnosis: "HTA", coverage: "PAMI" },
      { name: "López, Juan", date: "2026-02-01", diagnosis: "DM2", coverage: null },
    ]);
    expect(rows[0]?.token).toBe("PACIENTE_A");
    expect(rows[1]?.token).toBe("PACIENTE_B");
    expect(rows[0]?.diagnosis).toBe("HTA");
  });
});
