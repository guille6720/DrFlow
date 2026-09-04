import { type GeminiClinicStatsResult } from "@/lib/ai/gemini-clinic-stats";
import {
  emptyGeminiStructuredResponse,
  type GeminiStructuredResponse,
} from "@/lib/ai/gemini-structured-response";

export function geminiStatsToStructured(
  result: GeminiClinicStatsResult
): GeminiStructuredResponse {
  const filterBits = [result.protocolLabel, result.conditionLabel, result.coverageLabel].filter(
    Boolean
  );
  const filterText = filterBits.length ? ` · ${filterBits.join(" / ")}` : "";
  const summary =
    result.patientCount === 0
      ? `No hay pacientes en NexClinic que coincidan${filterText} en ${result.periodLabel}.`
      : `${result.patientCount} paciente${result.patientCount === 1 ? "" : "s"} en NexClinic${filterText} · ${result.periodLabel} (${result.visitCount} consulta${result.visitCount === 1 ? "" : "s"}).`;

  const findings = [
    result.protocolLabel ? `Protocolo: ${result.protocolLabel}` : null,
    `Período: ${result.periodLabel}`,
    `Pacientes únicos: ${result.patientCount}`,
    `Consultas: ${result.visitCount}`,
    ...result.topDiagnoses.slice(0, 5).map((row) => `${row.label}: ${row.count}`),
  ].filter((item): item is string => Boolean(item));

  const warnings = [
    ...(result.truncated
      ? ["Hay muchas consultas; el listado puede estar incompleto."]
      : []),
    ...(result.protocolLabel
      ? [
          "Coincidencia por texto de HC en NexClinic (diagnóstico/motivo/evolución). No reemplaza elegibilidad completa del protocolo.",
        ]
      : []),
  ];

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
