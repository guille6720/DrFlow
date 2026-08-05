import { PatientEhrActionLinks } from "@/features/historias/components/historias/patient-ehr-action-links";
import { PatientEhrDemographics } from "@/features/historias/components/historias/patient-ehr-demographics";
import { PatientEhrInteractiveBody } from "@/features/historias/components/historias/patient-ehr-interactive-body";
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
    <PatientEhrStateProvider consultations={consultations} attachments={attachments}>
      <div
        className={
          embedded
            ? "drflow-ehr-shell drflow-ehr-embedded print:bg-white"
            : "drflow-ehr-shell min-h-[calc(100vh-10rem)] print:bg-white"
        }
      >
        {embedded ? null : <PatientEhrDemographics patient={patient} />}

        <PatientEhrInteractiveBody
          patientId={patient.id}
          diagnosisRows={diagnosisRows}
          treatmentRows={treatmentRows}
          prescriptions={prescriptions}
          totalConsultations={totalConsultations}
          usesHceExport={usesHceExport}
          actionLinks={<PatientEhrActionLinks patientId={patient.id} />}
        />
      </div>
    </PatientEhrStateProvider>
  );
}
