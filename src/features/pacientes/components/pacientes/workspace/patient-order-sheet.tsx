"use client";

import { useState } from "react";

import { toast } from "@/core/notifications/toast";

import { PatientWorkspaceOverlay } from "@/features/pacientes/components/pacientes/workspace/patient-workspace-overlay";
import { MedicalOrderForm } from "@/features/recetas/components/recetas/medical-order-form";
import { MedicalOrderPreviewSheet } from "@/features/recetas/components/recetas/medical-order-preview-sheet";
import { buildMedicalOrderDocumentData } from "@/features/recetas/utils/build-medical-order-document-data";
import type { MedicalOrderDocumentData } from "@/features/recetas/utils/print-medical-order-document";

import type { MedicalOrder } from "@/types/medical-order";

type Professional = {
  id: string;
  license_number?: string | null;
  license_national?: string | null;
  license_provincial?: string | null;
  display_name?: string | null;
  signature_text?: string | null;
  signature_image_url?: string | null;
  profiles?: { full_name: string } | null;
  specialties?: { name: string } | { name: string }[] | null;
};

type Props = {
  open: boolean;
  patientId: string;
  patient: {
    first_name: string;
    last_name: string;
    document_number: string;
    birth_date?: string | null;
    insurance_provider?: string | null;
    insurance_number?: string | null;
  };
  patientInsurance?: string | null;
  patientInsurancePlan?: string | null;
  patientName: string;
  patientAllergies?: string | null;
  patientRegularMedication?: string | null;
  lastDiagnosis?: string | null;
  lastEvolution?: string | null;
  professionals: Professional[];
  defaultProfessionalId?: string;
  clinicalRecordId?: string;
  clinic: {
    name: string;
    address?: string | null;
    phone?: string | null;
  };
  onClose: () => void;
  onSaved: () => void;
};

export function PatientOrderSheet({
  open,
  patientId,
  patient,
  patientName,
  patientInsurance,
  patientInsurancePlan,
  patientAllergies,
  patientRegularMedication,
  lastDiagnosis,
  lastEvolution,
  professionals,
  defaultProfessionalId,
  clinicalRecordId,
  clinic,
  onClose,
  onSaved,
}: Props) {
  const [previewData, setPreviewData] = useState<MedicalOrderDocumentData | null>(null);
  const [formKey, setFormKey] = useState(0);

  function handleCreated(order?: MedicalOrder) {
    if (!order) {
      onSaved();
      return;
    }
    toast.success("Orden guardada");
    setPreviewData(
      buildMedicalOrderDocumentData(
        {
          id: order.id,
          order_text: order.order_text,
          notes: order.notes,
          status: order.status,
          issued_at: order.issued_at,
          created_at: order.created_at,
          updated_at: order.updated_at,
          version: order.version,
          professional_id: order.professional_id,
          patient_id: order.patient_id,
          clinical_record_id: order.clinical_record_id,
          order_type: order.order_type,
        },
        patient,
        clinic,
        professionals
      )
    );
  }

  function handlePreviewClose() {
    setPreviewData(null);
    setFormKey((k) => k + 1);
    onSaved();
  }

  function handleSheetClose() {
    setPreviewData(null);
    onClose();
  }

  return (
    <>
      <PatientWorkspaceOverlay
        open={open && !previewData}
        title="Nueva orden médica"
        subtitle={patientName}
        onClose={handleSheetClose}
        wide
      >
        <MedicalOrderForm
          key={formKey}
          patientId={patientId}
          clinicalRecordId={clinicalRecordId}
          professionals={professionals}
          defaultProfessionalId={defaultProfessionalId}
          onSuccess={handleCreated}
          onCancel={handleSheetClose}
          assistContext={{
            patientName,
            allergies: patientAllergies,
            regularMedication: patientRegularMedication,
            lastDiagnosis,
            lastEvolution,
            insurance: patientInsurance ?? undefined,
            insurancePlan: patientInsurancePlan,
          }}
        />
      </PatientWorkspaceOverlay>

      {previewData ? (
        <MedicalOrderPreviewSheet
          open={open && Boolean(previewData)}
          data={previewData}
          onClose={handlePreviewClose}
        />
      ) : null}
    </>
  );
}
