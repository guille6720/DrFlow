import type { ElectronicPrescription, PrescriptionMedication } from "@/types/prescription";

export type RefepsSubmissionMode = "local" | "sandbox" | "api";

export type RefepsClinicSettings = {
  enabled: boolean;
  establishmentCode: string | null;
  autoSubmit: boolean;
};

export type RefepsProfessionalContext = {
  id: string;
  fullName: string;
  licenseNational: string | null;
  licenseProvincial: string | null;
  licenseNumber: string | null;
  specialtyName: string | null;
  signatureText: string | null;
};

export type RefepsPatientContext = {
  id: string;
  documentNumber: string;
  firstName: string;
  lastName: string;
  insuranceProvider: string | null;
  insuranceNumber: string | null;
};

export type RefepsClinicContext = {
  id: string;
  name: string;
  establishmentCode: string | null;
};

export type RefepsPrescriptionPayload = {
  version: "1.0";
  source: "drflow";
  mode: RefepsSubmissionMode;
  clinic: {
    id: string;
    name: string;
    establishment_code: string | null;
  };
  professional: {
    id: string;
    full_name: string;
    license_national: string | null;
    license_provincial: string | null;
    specialty: string | null;
  };
  patient: {
    id: string;
    document_number: string;
    full_name: string;
    insurance_provider: string | null;
    insurance_number: string | null;
  };
  prescription: {
    id: string;
    number: string | null;
    type: string;
    issued_at: string;
    validity_days: number;
    diagnosis_cie10: string | null;
    diagnosis_text: string | null;
    coverage_kind: string | null;
    medications: PrescriptionMedication[];
  };
  digital_signature_hash: string;
  generated_at: string;
};

export type RefepsSubmitResult =
  | {
      ok: true;
      refepsId: string;
      mode: RefepsSubmissionMode;
      verificationUrl?: string | null;
      payload: RefepsPrescriptionPayload;
      signatureHash: string;
    }
  | { ok: false; error: string };

export type RefepsPrescriptionUpdate = {
  refeps_status: "submitted" | "failed" | "pending_refeps";
  refeps_id?: string | null;
  refeps_submitted_at?: string | null;
  refeps_error?: string | null;
  refeps_payload?: RefepsPrescriptionPayload | null;
  digital_signature_hash?: string | null;
};

export function isRefepsSubmitted(
  prescription: Pick<ElectronicPrescription, "refeps_status">
): boolean {
  return prescription.refeps_status === "submitted";
}
