import { type GeminiClinicStatsResult } from "@/lib/ai/gemini-clinic-stats";
import {
  emptyGeminiStructuredResponse,
  type GeminiStructuredResponse,
} from "@/lib/ai/gemini-structured-response";

export function geminiStatsToStructured(
  result: GeminiClinicStatsResult
): GeminiStructuredResponse {
  const filterBits = [result.conditionLabel, result.coverageLabel].filter(Boolean);
  const filterText = filterBits.length ? ` con ${filterBits.join(" / ")}` : "";
  const summary =
    result.patientCount === 0
      ? `No hay pacientes${filterText} atendidos en ${result.periodLabel}.`
      : `${result.patientCount} paciente${result.patientCount === 1 ? "" : "s"}${filterText} en ${result.periodLabel} (${result.visitCount} consulta${result.visitCount === 1 ? "" : "s"}).`;

  const findings = [
    `Período: ${result.periodLabel}`,
    `Pacientes únicos: ${result.patientCount}`,
    `Consultas: ${result.visitCount}`,
    ...result.topDiagnoses.slice(0, 5).map((row) => `${row.label}: ${row.count}`),
  ];

  const warnings = result.truncated
    ? ["El período tiene muchas consultas; el listado puede estar incompleto."]
    : [];

  return {
    ...emptyGeminiStructuredResponse(summary),
    findings,
    warnings,
    patients: result.patients.map((row) => ({
      id: row.id,
      name: row.name,
      date: row.date,
      diagnosis: row.diagnosis,
    })),
  };
}
