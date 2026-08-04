"use client";

import { PatientWhatsAppButton } from "@/features/pacientes/components/patient-whatsapp-button";
import { PatientEhrDemographicCell } from "@/features/historias/components/historias/patient-ehr-primitives";
import type { PatientEhrPatientInfo } from "@/features/historias/components/historias/patient-ehr-types";
import { buildPatientContactMessage } from "@/features/pacientes/utils/patient-messages";

export function PatientEhrDemographics({ patient }: { patient: PatientEhrPatientInfo }) {
  const patientFormal = `${patient.last_name}, ${patient.first_name}`;
  const patientDisplay = `${patient.first_name} ${patient.last_name}`;

  return (
    <div className="drflow-ehr-demographics flex flex-wrap border-b border-[var(--border)]">
      <PatientEhrDemographicCell label="Nombre" value={patientFormal} />
      <PatientEhrDemographicCell label="DNI" value={patient.document_number} />
      <PatientEhrDemographicCell label="Edad" value={patient.age_label ?? "Sin definir"} />
      <PatientEhrDemographicCell label="Sexo" value="Sin definir" />
      <PatientEhrDemographicCell
        label="Obra social"
        value={patient.insurance_provider ?? "Sin definir"}
      />
      <PatientEhrDemographicCell
        label="N° afiliado"
        value={patient.insurance_number ?? "Sin definir"}
      />
      <PatientEhrDemographicCell
        label="Teléfono"
        value={
          patient.phone ? (
            <span className="inline-flex items-center gap-1">
              {patient.phone}
              <PatientWhatsAppButton
                phone={patient.phone}
                message={buildPatientContactMessage(patientDisplay)}
                size="icon"
              />
            </span>
          ) : (
            "Sin definir"
          )
        }
      />
      <PatientEhrDemographicCell label="Email" value={patient.email?.trim() || "Sin definir"} />
    </div>
  );
}
