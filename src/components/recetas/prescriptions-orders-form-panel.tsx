"use client";

import { Pill } from "lucide-react";
import { Card } from "@/components/ui/card";
import { PrescriptionForm } from "@/components/recetas/prescription-form";
import { MedicalOrderForm } from "@/components/recetas/medical-order-form";
import type {
  PrescriptionsOrdersPatient,
  PrescriptionsOrdersProfessional,
  PrescriptionsOrdersTab,
} from "@/components/recetas/prescriptions-orders-types";
import type { PrescriptionMedication } from "@/types/prescription";
import type { ConsultationDraftContext } from "@/lib/utils/consultation-draft";

type Props = {
  activeTab: PrescriptionsOrdersTab;
  patient: PrescriptionsOrdersPatient;
  professionals: PrescriptionsOrdersProfessional[];
  defaultProfessionalId?: string;
  consultationContext: ConsultationDraftContext | null;
  draftKey: string | null;
  consultaMedicationsCount: number;
  initialMedications?: PrescriptionMedication[];
  diagnosisForForm: string;
  medicationsForForm?: PrescriptionMedication[];
  prefillCie10: string;
  onPrescriptionSuccess: () => void;
  onOrderSuccess: () => void;
};

export function PrescriptionsOrdersFormPanel({
  activeTab,
  patient,
  professionals,
  defaultProfessionalId,
  consultationContext,
  draftKey,
  consultaMedicationsCount,
  initialMedications,
  diagnosisForForm,
  medicationsForForm,
  prefillCie10,
  onPrescriptionSuccess,
  onOrderSuccess,
}: Props) {
  const defaultPro =
    consultationContext?.professionalId ?? defaultProfessionalId ?? professionals[0]?.id;

  return (
    <Card
      title={activeTab === "receta" ? "Nueva receta electrónica" : "Nueva orden médica"}
      description={
        activeTab === "receta"
          ? "Emisión local conforme Ley 25.649"
          : "Estudios, derivaciones PAMI e indicaciones"
      }
    >
      {activeTab === "receta" ? (
        <>
          {consultationContext && consultaMedicationsCount > 0 ? (
            <p className="mb-4 rounded-lg border border-teal-200 bg-teal-50 px-3 py-2 text-sm text-teal-900">
              <Pill className="mr-1 inline h-4 w-4" />
              Medicación importada desde la evolución de la consulta en curso. Revisá posología y
              presentación antes de emitir.
            </p>
          ) : null}
          {!consultationContext && initialMedications && initialMedications.length > 0 ? (
            <p className="mb-4 rounded-lg border border-teal-200 bg-teal-50 px-3 py-2 text-sm text-teal-900">
              <Pill className="mr-1 inline h-4 w-4" />
              Medicación precargada desde la última receta o tratamiento habitual. Revisá antes de
              emitir.
            </p>
          ) : null}
          <PrescriptionForm
            key={
              draftKey
                ? `consulta-${draftKey}-${consultaMedicationsCount}-${diagnosisForForm.length}`
                : "default"
            }
            patientId={patient.id}
            patientInsurance={patient.insurance_provider}
            diagnosisDefault={diagnosisForForm}
            cie10Default={prefillCie10}
            professionals={professionals}
            defaultProfessionalId={defaultPro}
            initialMedications={medicationsForForm}
            clinicalRecordId={consultationContext?.recordId}
            onSuccess={onPrescriptionSuccess}
            assistContext={{
              patientName: `${patient.last_name}, ${patient.first_name}`,
              diagnosis: diagnosisForForm,
              insurance: patient.insurance_provider ?? undefined,
              insurancePlan: patient.insurance_number ?? undefined,
            }}
          />
        </>
      ) : (
        <MedicalOrderForm
          patientId={patient.id}
          professionals={professionals}
          defaultProfessionalId={defaultPro}
          onSuccess={onOrderSuccess}
          assistContext={{
            patientName: `${patient.last_name}, ${patient.first_name}`,
            diagnosis: diagnosisForForm,
            insurance: patient.insurance_provider ?? undefined,
            insurancePlan: patient.insurance_number ?? undefined,
          }}
        />
      )}
    </Card>
  );
}
