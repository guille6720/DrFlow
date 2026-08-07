import {
  formatPrintAgeBlock,
  formatPrintDocumentNumber,
} from "@/features/historias/components/historias/patient-ehr-print-utils";
import type { PatientEhrPatientInfo } from "@/features/historias/components/historias/patient-ehr-types";

type Props = {
  patient: PatientEhrPatientInfo;
};

export function PatientEhrPrintDemographics({ patient }: Props) {
  const patientFormal = `${patient.last_name}, ${patient.first_name}`.toLowerCase();
  const insurance = patient.insurance_provider?.trim() || "Sin definir";

  return (
    <section className="drflow-ehr-print-demographics" aria-label="Datos del paciente">
      <div className="drflow-ehr-print-demo-grid">
        <div className="drflow-ehr-print-demo-field">
          <p className="drflow-ehr-print-demo-label">Nombre</p>
          <p className="drflow-ehr-print-demo-value">{patientFormal}</p>
        </div>
        <div className="drflow-ehr-print-demo-field">
          <p className="drflow-ehr-print-demo-label">DNI</p>
          <p className="drflow-ehr-print-demo-value">
            {formatPrintDocumentNumber(patient.document_number)}
          </p>
        </div>
        <div className="drflow-ehr-print-demo-field">
          <p className="drflow-ehr-print-demo-label">Edad</p>
          <p className="drflow-ehr-print-demo-value drflow-ehr-print-demo-age">
            {formatPrintAgeBlock(patient.birth_date, patient.age_label)}
          </p>
        </div>
      </div>
      <div className="drflow-ehr-print-demo-grid drflow-ehr-print-demo-grid-secondary">
        <div className="drflow-ehr-print-demo-field">
          <p className="drflow-ehr-print-demo-label">{insurance}</p>
          {patient.insurance_number ? (
            <p className="drflow-ehr-print-demo-value"># {patient.insurance_number}</p>
          ) : null}
        </div>
        <div className="drflow-ehr-print-demo-field">
          <p className="drflow-ehr-print-demo-label">Teléfono</p>
          <p className="drflow-ehr-print-demo-value">{patient.phone?.trim() || "Sin definir"}</p>
        </div>
      </div>
    </section>
  );
}
