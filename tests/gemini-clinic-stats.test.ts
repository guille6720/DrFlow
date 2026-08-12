import { describe, expect, it } from "vitest";

import {
  foldStatsText,
  formatGeminiClinicStatsContext,
  parseGeminiClinicStatsQuery,
  textMatchesCondition,
} from "@/lib/ai/gemini-clinic-stats";
import { geminiStatsToStructured } from "@/lib/ai/gemini-stats-response";

describe("parseGeminiClinicStatsQuery", () => {
  it("detects hypertension attended this month", () => {
    const query = parseGeminiClinicStatsQuery(
      "¿cuantos pacientes con hipertension se atendieron este mes?"
    );
    expect(query).not.toBeNull();
    expect(query?.period).toBe("monthly");
    expect(query?.condition?.id).toBe("hta");
  });

  it("detects unique patients this month without a condition", () => {
    const query = parseGeminiClinicStatsQuery("¿Cuántos pacientes se atendieron este mes?");
    expect(query?.period).toBe("monthly");
    expect(query?.condition).toBeNull();
  });

  it("detects top diagnoses", () => {
    const query = parseGeminiClinicStatsQuery("Diagnósticos más frecuentes este mes");
    expect(query?.wantTopDiagnoses).toBe(true);
  });

  it("ignores single-patient clinical prompts", () => {
    expect(parseGeminiClinicStatsQuery("Resumen de las últimas evoluciones")).toBeNull();
    expect(parseGeminiClinicStatsQuery("Redactá un motivo de consulta breve")).toBeNull();
  });

  it("detects PAMI coverage and last month", () => {
    const query = parseGeminiClinicStatsQuery("¿Cuántos pacientes PAMI se atendieron el mes pasado?");
    expect(query?.coverageNeedle).toBe("pami");
    expect(query?.period).toBe("last_month");
  });
});

describe("textMatchesCondition", () => {
  it("matches HTA and hipertensión in diagnosis text", () => {
    const hta = parseGeminiClinicStatsQuery("pacientes con hta este mes")!.condition!;
    expect(textMatchesCondition("Control HTA", hta)).toBe(true);
    expect(textMatchesCondition("Hipertensión arterial esencial", hta)).toBe(true);
    expect(textMatchesCondition("Resfrío común", hta)).toBe(false);
  });
});

describe("geminiStatsToStructured", () => {
  it("lists every patient from the clinic query", () => {
    const structured = geminiStatsToStructured({
      periodLabel: "agosto 2026",
      conditionLabel: "hipertensión",
      coverageLabel: null,
      visitCount: 3,
      patientCount: 2,
      truncated: false,
      topDiagnoses: [{ label: "HTA", count: 3 }],
      patients: [
        { id: "p1", name: "García, Ana", date: "2026-08-02", diagnosis: "HTA", coverage: null },
        { id: "p2", name: "Pérez, Juan", date: "2026-08-10", diagnosis: "HTA esencial", coverage: null },
      ],
    });

    expect(structured.summary).toContain("2 pacientes");
    expect(structured.patients).toHaveLength(2);
    expect(structured.patients?.[0]?.name).toContain("García");
  });
});

describe("formatGeminiClinicStatsContext", () => {
  it("includes folded-safe patient names for the model", () => {
    const text = formatGeminiClinicStatsContext({
      periodLabel: "agosto 2026",
      conditionLabel: "hipertensión",
      coverageLabel: null,
      visitCount: 1,
      patientCount: 1,
      truncated: false,
      topDiagnoses: [],
      patients: [
        { id: "p1", name: "García, Ana", date: "2026-08-02", diagnosis: "HTA", coverage: null },
      ],
    });
    expect(text).toContain("García, Ana");
    expect(foldStatsText("Hipertensión")).toContain("hipertens");
  });
});
