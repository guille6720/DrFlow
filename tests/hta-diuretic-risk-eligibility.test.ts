import { describe, expect, it } from "vitest";

import { parseGeminiClinicStatsQuery } from "@/lib/ai/gemini-clinic-stats";
import { foldMedicalText } from "@/lib/ai/gemini-medical-lexicon";
import {
  compareHtaDiureticRiskScores,
  messageWantsHtaDiureticRiskScreening,
  scoreHtaDiureticRisk,
} from "@/lib/ai/hta-diuretic-risk-eligibility";

describe("scoreHtaDiureticRisk", () => {
  const now = new Date("2026-09-09T12:00:00Z");

  it("requires ≥2 antihypertensives including a diuretic and ≥2 risk factors", () => {
    const score = scoreHtaDiureticRisk({
      birthDate: "1950-01-01", // > 70
      regularMedication: "Enalapril 10 mg + Hidroclorotiazida 12.5 mg",
      hcBlob: "HTA. Diabetes tipo 2. Tabaquista activo.",
      now,
    });
    expect(score.passesGate).toBe(true);
    expect(score.hasDiuretic).toBe(true);
    expect(score.factorCount).toBeGreaterThanOrEqual(2);
    expect(score.eligible).toBe(true);
    expect(score.factors).toEqual(
      expect.arrayContaining(["age_over_70", "diabetes", "smoker"])
    );
  });

  it("rejects patients without a diuretic even with two AHT classes", () => {
    const score = scoreHtaDiureticRisk({
      birthDate: "1950-01-01",
      regularMedication: "Enalapril + Amlodipina",
      hcBlob: "HTA, diabetes, fumador activo",
      now,
    });
    expect(score.passesGate).toBe(false);
    expect(score.eligible).toBe(false);
  });

  it("marks hasAllFactors when all six risk factors are present", () => {
    const score = scoreHtaDiureticRisk({
      birthDate: "1948-05-01",
      regularMedication: "Losartan + Indapamida + Bisoprolol",
      hcBlob:
        "HTA. Fibrilación auricular. Diabetes. Tabaquista. IMC 32. TFG 48. Obesidad.",
      chartExtras: {
        smoker: "active",
        weight_kg: 95,
        height_cm: 165,
      },
      now,
    });
    expect(score.eligible).toBe(true);
    expect(score.hasAllFactors).toBe(true);
    expect(score.factorCount).toBe(6);
  });

  it("sorts all-factors patients first", () => {
    const full = scoreHtaDiureticRisk({
      birthDate: "1948-01-01",
      regularMedication: "Enalapril + HCTZ",
      hcBlob: "FA, diabetes, tabaquista, IMC 31, TFG 50",
      chartExtras: { smoker: "active", weight_kg: 90, height_cm: 170 },
      now,
    });
    const partial = scoreHtaDiureticRisk({
      birthDate: "1948-01-01",
      regularMedication: "Enalapril + Indapamida",
      hcBlob: "Diabetes y tabaquista",
      chartExtras: { smoker: "active" },
      now,
    });
    expect(compareHtaDiureticRiskScores(full, partial)).toBeLessThan(0);
  });
});

describe("messageWantsHtaDiureticRiskScreening", () => {
  it("detects natural-language multi-factor requests", () => {
    const folded = foldMedicalText(
      "Buscar pacientes con 2 antihipertensivos incluyendo un diurético y factores de riesgo"
    );
    expect(messageWantsHtaDiureticRiskScreening(folded)).toBe(true);
  });
});

describe("parseGeminiClinicStatsQuery hta screening", () => {
  it("enables screening for ZENITH candidates", () => {
    const query = parseGeminiClinicStatsQuery("Candidatos ZENITH");
    expect(query?.protocol?.id).toBe("zenith");
    expect(query?.htaDiureticRiskScreening).toBe(true);
  });

  it("enables screening from described criteria", () => {
    const query = parseGeminiClinicStatsQuery(
      "pacientes que usan 2 antihipertensivos incluyendo un diurético + diabetes o tabaquista"
    );
    expect(query?.htaDiureticRiskScreening).toBe(true);
  });
});
