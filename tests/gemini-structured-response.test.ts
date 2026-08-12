import { describe, expect, it } from "vitest";

import {
  formatGeminiStructuredBody,
  parseGeminiStructuredResponse,
} from "@/lib/ai/gemini-structured-response";

describe("parseGeminiStructuredResponse", () => {
  it("parses JSON with findings and suggestions", () => {
    const parsed = parseGeminiStructuredResponse(`{
      "summary": "Control de HTA estable.",
      "findings": ["PA referida en rango"],
      "suggestions": ["Completar signos vitales"],
      "warnings": [],
      "disclaimer": "Sugerencia asistida — requiere confirmación del médico. No reemplaza criterio clínico."
    }`);

    expect(parsed.summary).toContain("HTA");
    expect(parsed.findings).toEqual(["PA referida en rango"]);
    expect(parsed.suggestions[0]).toContain("signos vitales");
  });

  it("wraps free text as summary", () => {
    const parsed = parseGeminiStructuredResponse("No hay evoluciones previas.");
    expect(parsed.summary).toBe("No hay evoluciones previas.");
    expect(parsed.findings).toEqual([]);
  });
});

describe("formatGeminiStructuredBody", () => {
  it("joins sections for the chat transcript", () => {
    const body = formatGeminiStructuredBody({
      summary: "Resumen",
      findings: ["Hallazgo"],
      suggestions: [],
      warnings: ["Alerta"],
      disclaimer: "Disclaimer",
    });
    expect(body).toContain("Hallazgos");
    expect(body).toContain("Alertas");
    expect(body).toContain("Disclaimer");
  });
});
