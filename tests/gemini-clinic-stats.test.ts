import { describe, expect, it } from "vitest";

import {
  foldStatsText,
  formatGeminiClinicStatsContext,
  parseGeminiClinicStatsQuery,
  textMatchesCondition,
} from "@/lib/ai/gemini-clinic-stats";
import { findProtocolByMessage, foldMedicalText } from "@/lib/ai/gemini-medical-lexicon";
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

  it("uses full NexClinic history when searching a term without period", () => {
    const query = parseGeminiClinicStatsQuery("¿Cuántos pacientes con asma hay?");
    expect(query?.condition?.id).toBe("asma");
    expect(query?.period).toBe("all");
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

  it("detects MARITIME-CV candidates and protocol criteria", () => {
    const query = parseGeminiClinicStatsQuery("Candidatos para MARITIME-CV");
    expect(query?.protocol?.id).toBe("maritime-cv");
    expect(query?.condition?.id).toBe("protocol:maritime-cv");
    expect(query?.period).toBe("all");
  });

  it("detects PRESTO protocol criteria", () => {
    const query = parseGeminiClinicStatsQuery("Criterios del estudio PRESTO");
    expect(query?.protocol?.id).toBe("presto");
    expect(query?.wantProtocolCriteria).toBe(true);
  });

  it("detects EPOC and bronquiectasias terms", () => {
    expect(parseGeminiClinicStatsQuery("pacientes con EPOC")?.condition?.id).toBe("epoc");
    expect(parseGeminiClinicStatsQuery("lista de bronquiectasias")?.condition?.id).toBe(
      "bronquiectasias"
    );
  });
});

describe("textMatchesCondition", () => {
  it("matches HTA and hipertensión in diagnosis text", () => {
    const hta = parseGeminiClinicStatsQuery("pacientes con hta este mes")!.condition!;
    expect(textMatchesCondition("Control HTA", hta)).toBe(true);
    expect(textMatchesCondition("Hipertensión arterial esencial", hta)).toBe(true);
    expect(textMatchesCondition("Resfrío común", hta)).toBe(false);
  });

  it("matches protocol candidate needles from HC text", () => {
    const query = parseGeminiClinicStatsQuery("candidatos gzmr asma")!;
    expect(textMatchesCondition("Asma severa no controlada, IMC 28", query.condition!)).toBe(true);
  });
});

describe("findProtocolByMessage", () => {
  it("resolves aliases from clinical flyers", () => {
    expect(findProtocolByMessage(foldMedicalText("muvalaplin lp(a)"))?.id).toBe("ekgb");
    expect(findProtocolByMessage(foldMedicalText("baxdrostat erc"))?.id).toBe("bax-duo");
    expect(findProtocolByMessage(foldMedicalText("zenagamtide polaris"))?.id).toBe("hf-polaris");
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
      protocolLabel: null,
      protocolContext: null,
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
      protocolLabel: null,
      protocolContext: null,
    });
    expect(text).toContain("García, Ana");
    expect(foldStatsText("Hipertensión")).toContain("hipertens");
  });
});
