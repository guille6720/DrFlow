import { createHash } from "node:crypto";

import type {
  RefepsClinicContext,
  RefepsPatientContext,
  RefepsPrescriptionPayload,
  RefepsProfessionalContext,
  RefepsSubmissionMode,
} from "@/core/refeps/types";

import type { ElectronicPrescription } from "@/types/prescription";

function stableStringify(value: unknown): string {
  if (value == null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  }
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record).sort();
  return `{${keys.map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`).join(",")}}`;
}

export function hashRefepsPayload(payload: Omit<RefepsPrescriptionPayload, "digital_signature_hash">): string {
  return createHash("sha256").update(stableStringify(payload)).digest("hex");
}

export function buildRefepsPrescriptionPayload(input: {
  mode: RefepsSubmissionMode;
  clinic: RefepsClinicContext;
  professional: RefepsProfessionalContext;
  patient: RefepsPatientContext;
  prescription: ElectronicPrescription;
  signatureHash: string;
}): RefepsPrescriptionPayload {
  return {
    version: "1.0",
    source: "drflow",
    mode: input.mode,
    clinic: {
      id: input.clinic.id,
      name: input.clinic.name,
      establishment_code: input.clinic.establishmentCode,
    },
    professional: {
      id: input.professional.id,
      full_name: input.professional.fullName,
      license_national: input.professional.licenseNational,
      license_provincial: input.professional.licenseProvincial,
      specialty: input.professional.specialtyName,
    },
    patient: {
      id: input.patient.id,
      document_number: input.patient.documentNumber,
      full_name: `${input.patient.firstName} ${input.patient.lastName}`.trim(),
      insurance_provider: input.patient.insuranceProvider,
      insurance_number: input.patient.insuranceNumber,
    },
    prescription: {
      id: input.prescription.id,
      number: input.prescription.prescription_number,
      type: input.prescription.prescription_type,
      issued_at: input.prescription.issued_at ?? new Date().toISOString(),
      validity_days: input.prescription.validity_days,
      diagnosis_cie10: input.prescription.diagnosis_cie10,
      diagnosis_text: input.prescription.diagnosis_text,
      coverage_kind: input.prescription.coverage_kind,
      medications: input.prescription.medications,
    },
    digital_signature_hash: input.signatureHash,
    generated_at: new Date().toISOString(),
  };
}

export function buildUnsignedRefepsPayload(input: {
  mode: RefepsSubmissionMode;
  clinic: RefepsClinicContext;
  professional: RefepsProfessionalContext;
  patient: RefepsPatientContext;
  prescription: ElectronicPrescription;
}): { payload: RefepsPrescriptionPayload; signatureHash: string } {
  const base = buildRefepsPrescriptionPayload({
    ...input,
    signatureHash: "",
  });
  const { digital_signature_hash: _ignored, ...unsigned } = base;
  const signatureHash = hashRefepsPayload(unsigned);
  return {
    signatureHash,
    payload: buildRefepsPrescriptionPayload({
      ...input,
      signatureHash,
    }),
  };
}

export function validateRefepsSubmissionPrerequisites(input: {
  prescription: ElectronicPrescription;
  professional: RefepsProfessionalContext;
  patient: RefepsPatientContext;
  clinicSettings: { enabled: boolean; establishmentCode: string | null };
}): string | null {
  if (input.prescription.status !== "issued") {
    return "Solo se pueden enviar recetas emitidas a REFEPS.";
  }
  if (!input.clinicSettings.enabled) {
    return "REFEPS no está habilitado para este consultorio.";
  }
  if (!input.patient.documentNumber.trim()) {
    return "El paciente debe tener documento cargado para REFEPS.";
  }
  const hasLicense =
    Boolean(input.professional.licenseNational?.trim()) ||
    Boolean(input.professional.licenseProvincial?.trim()) ||
    Boolean(input.professional.licenseNumber?.trim());
  if (!hasLicense) {
    return "El profesional debe tener matrícula nacional o provincial cargada.";
  }
  if (input.prescription.medications.length === 0) {
    return "La receta no tiene medicamentos.";
  }
  return null;
}
