export type GeminiClinicalRecord = {
  date: string;
  chiefComplaint: string;
  diagnosis: string;
  evolution: string;
  indications: string;
};

export type GeminiClinicalContext = {
  patientToken: "PACIENTE_A";
  ageYears: number | null;
  insuranceProvider: string | null;
  records: GeminiClinicalRecord[];
};

export function formatGeminiClinicalContext(context: GeminiClinicalContext): string {
  const header = [
    `Paciente: ${context.patientToken}`,
    context.ageYears != null ? `Edad: ${context.ageYears} años` : null,
    context.insuranceProvider ? `Cobertura: ${context.insuranceProvider}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  if (context.records.length === 0) {
    return `${header}\nSin evoluciones clínicas previas.`;
  }

  const records = context.records
    .map((record, index) => {
      const lines = [
        `Consulta ${index + 1} (${record.date})`,
        record.chiefComplaint ? `Motivo: ${record.chiefComplaint}` : null,
        record.diagnosis ? `Diagnóstico: ${record.diagnosis}` : null,
        record.evolution ? `Evolución: ${record.evolution}` : null,
        record.indications ? `Indicaciones: ${record.indications}` : null,
      ].filter(Boolean);
      return lines.join("\n");
    })
    .join("\n\n");

  return `${header}\n\n${records}`;
}
