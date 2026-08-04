import { describe, expect, it } from "vitest";
import {
  buildCie10Suggestions,
  buildEvolutionDraftSuggestion,
  buildPhysicalExamSuggestion,
  buildTherapeuticPlanSuggestion,
  extractCie10FromDifferentialBody,
} from "@/lib/utils/consultation-documentation";

describe("consultation-documentation", () => {
  it("buildEvolutionDraftSuggestion structures complaint text", () => {
    const item = buildEvolutionDraftSuggestion({
      evolutionText: "Dolor lumbar hace tres semanas, sin irradiación, no fiebre.",
    });
    expect(item?.kind).toBe("evolution_draft");
    expect(item?.body).toContain("Motivo de consulta");
    expect(item?.body).toContain("Sin irradiación");
    expect(item?.body).toContain("Niega fiebre");
  });

  it("buildPhysicalExamSuggestion matches lumbar keywords", () => {
    const item = buildPhysicalExamSuggestion({
      evolutionText: "Paciente con dolor lumbar hace 2 semanas",
    });
    expect(item?.body).toContain("Lasègue");
    expect(item?.body).toContain("Examen físico sugerido");
  });

  it("buildTherapeuticPlanSuggestion matches lumbar keywords", () => {
    const item = buildTherapeuticPlanSuggestion({
      evolutionText: "Lumbalgia mecánica en tratamiento",
    });
    expect(item?.body).toContain("Plan terapéutico");
    expect(item?.body).toContain("Analgesia");
  });

  it("buildCie10Suggestions returns codes for matched context", () => {
    const suggestions = buildCie10Suggestions({
      evolutionText: "dolor lumbar persistente",
    });
    expect(suggestions.some((s) => s.code === "M54.5")).toBe(true);
  });

  it("extractCie10FromDifferentialBody maps differential lines", () => {
    const suggestions = extractCie10FromDifferentialBody(
      "1. Lumbalgia mecánica\n2. Hernia discal lumbar\n\nVerificar con examen."
    );
    expect(suggestions.some((s) => s.code === "M54.5")).toBe(true);
    expect(suggestions.some((s) => s.code === "M51.2")).toBe(true);
  });
});
