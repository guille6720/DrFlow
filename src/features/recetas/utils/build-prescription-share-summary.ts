import type { HistoriaPrescriptionSummary } from "@/features/historias/types/historia-clinical-summaries";
import {
  formatPrescriptionCoverageLines,
  resolvePrescriptionDocumentCoverage,
} from "@/features/recetas/utils/prescription-document-coverage";

import type { PrescriptionMedication } from "@/types/prescription";

type PatientInfo = {
  first_name: string;
  last_name: string;
  insurance_provider?: string | null;
  insurance_number?: string | null;
};

export function buildPrescriptionShareSummary(
  prescription: HistoriaPrescriptionSummary,
  patient: PatientInfo
): string {
  const meds = (prescription.medications as PrescriptionMedication[]) ?? [];
  const medLines = meds
    .map(
      (m, i) =>
        `${i + 1}. ${m.generic_name}${m.presentation ? ` (${m.presentation})` : ""} — ${m.posology}`
    )
    .join("\n");

  const coverage = resolvePrescriptionDocumentCoverage({
    coverage_kind: prescription.coverage_kind,
    patient_insurance: prescription.patient_insurance,
    insurance_number: prescription.insurance_number,
    insurance_plan: prescription.insurance_plan,
    patientInsuranceFallback: patient.insurance_provider,
    patientNumberFallback: patient.insurance_number,
  });
  const coverageLines = formatPrescriptionCoverageLines(coverage);

  return [
    `Receta médica — ${patient.last_name}, ${patient.first_name}`,
    ...coverageLines,
    prescription.diagnosis_text ? `Diagnóstico: ${prescription.diagnosis_text}` : "",
    prescription.diagnosis_cie10 ? `CIE-10: ${prescription.diagnosis_cie10}` : "",
    "",
    "Medicamentos:",
    medLines,
    "",
    prescription.prescription_number
      ? `Nº ${prescription.prescription_number}`
      : "Generada en NexClinic",
    "",
    "Receta local / borrador NexClinic — no es homologación REFEPS. Verificar en farmacia.",
  ]
    .filter(Boolean)
    .join("\n");
}
