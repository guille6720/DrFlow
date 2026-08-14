import { PatientEhrActionLinks } from "@/features/historias/components/historias/patient-ehr-action-links";
import { PatientEhrDemographics } from "@/features/historias/components/historias/patient-ehr-demographics";
import { PatientEhrInteractiveBody } from "@/features/historias/components/historias/patient-ehr-interactive-body";
import { PatientEhrPrintDemographics } from "@/features/historias/components/historias/patient-ehr-print-demographics";
import { PatientEhrShellFrame } from "@/features/historias/components/historias/patient-ehr-shell-frame";
import { PatientEhrStateProvider } from "@/features/historias/components/historias/patient-ehr-state-context";
import type { PatientEhrViewProps } from "@/features/historias/components/historias/patient-ehr-types";

export function PatientEhrView({
  patient,
  consultations,
  diagnosisRows,
  treatmentRows,
  attachments,
  prescriptions,
  totalConsultations,
  usesHceExport = false,
  embedded = false,
}: PatientEhrViewProps) {
  return (
    <PatientEhrStateProvider
      consultations={consultations}
      attachments={attachments}
      patient={patient}
      diagnosisRows={diagnosisRows}
      treatmentRows={treatmentRows}
    >
      <PatientEhrShellFrame embedded={embedded}>
        {!embedded ? (
          <PatientEhrDemographics patient={patient} totalConsultations={totalConsultations} />
        ) : null}
        <div className="drflow-ehr-print-demographics-wrap">
          <PatientEhrPrintDemographics
            patient={patient}
            totalConsultations={totalConsultations}
          />
        </div>

        <PatientEhrInteractiveBody
          patientId={patient.id}
          diagnosisRows={diagnosisRows}
          treatmentRows={treatmentRows}
          prescriptions={prescriptions}
          totalConsultations={totalConsultations}
          usesHceExport={usesHceExport}
          actionLinks={<PatientEhrActionLinks patientId={patient.id} historyOnly />}
        />
      </PatientEhrShellFrame>
    </PatientEhrStateProvider>
  );
}
