"use client";

import type { ReactNode } from "react";

import { PatientEhrClinicalTables } from "@/features/historias/components/historias/patient-ehr-clinical-tables";
import { PatientEhrEvolutionPanel } from "@/features/historias/components/historias/patient-ehr-evolution-panel";
import { PatientEhrFiltersBar } from "@/features/historias/components/historias/patient-ehr-filters-bar";
import { PatientEhrPrintEvolutionBlock } from "@/features/historias/components/historias/patient-ehr-print-evolution-block";
import { PatientEhrSidebar } from "@/features/historias/components/historias/patient-ehr-sidebar";
import { usePatientEhrStateContext } from "@/features/historias/components/historias/patient-ehr-state-context";
import { PatientEhrSupplementalSections } from "@/features/historias/components/historias/patient-ehr-supplemental-sections";
import type {
  PatientEhrDiagnosisRow,
  PatientEhrPrescription,
  PatientEhrTreatmentRow,
} from "@/features/pacientes/utils/patient-ehr-model";

type Props = {
  patientId: string;
  diagnosisRows: PatientEhrDiagnosisRow[];
  treatmentRows: PatientEhrTreatmentRow[];
  prescriptions: PatientEhrPrescription[];
  totalConsultations: number;
  usesHceExport?: boolean;
  actionLinks: ReactNode;
};

export function PatientEhrInteractiveBody({
  patientId,
  diagnosisRows,
  treatmentRows,
  prescriptions,
  totalConsultations,
  usesHceExport = false,
  actionLinks,
}: Props) {
  const {
    evolutionList,
    setSelectedId,
    filters,
    toggleFilter,
    openingAttachmentId,
    attachmentError,
    visibleAttachments,
    handleOpenAttachment,
    selected,
    selectedDocumentAttachment,
    vitalsRows,
    dayPrintConsultations,
  } = usePatientEhrStateContext();

  return (
    <>
      <PatientEhrFiltersBar
        filters={filters}
        onToggleFilter={toggleFilter}
        totalConsultations={totalConsultations}
        usesHceExport={usesHceExport}
      />

      <div className="drflow-ehr-layout flex flex-col lg:flex-row lg:items-stretch">
        {filters.evolutions ? (
          <PatientEhrSidebar
            evolutionList={evolutionList}
            selectedId={selected?.id}
            onSelect={setSelectedId}
          />
        ) : null}

        <main className="drflow-ehr-main min-w-0 flex-1">
          <div className="p-4">
            {actionLinks}

            {filters.evolutions ? (
              <>
                <div className="drflow-ehr-screen-only">
                  <PatientEhrEvolutionPanel
                    patientId={patientId}
                    selected={selected}
                    selectedDocumentAttachment={selectedDocumentAttachment}
                    openingAttachmentId={openingAttachmentId}
                    onOpenAttachment={handleOpenAttachment}
                  />
                </div>

                <div className="drflow-ehr-print-only drflow-ehr-print-day-content mt-3 space-y-3">
                  {dayPrintConsultations.map((consultation) => (
                    <PatientEhrPrintEvolutionBlock key={consultation.id} consultation={consultation} />
                  ))}
                </div>

                <div className="drflow-ehr-print-only drflow-ehr-print-all-content mt-3 space-y-3">
                  {evolutionList.map((consultation) => (
                    <PatientEhrPrintEvolutionBlock key={consultation.id} consultation={consultation} />
                  ))}
                </div>
              </>
            ) : null}

            <div className="drflow-ehr-print-supplemental">
            <PatientEhrClinicalTables
              patientId={patientId}
              diagnosisRows={diagnosisRows}
              treatmentRows={treatmentRows}
              showDiagnostics={filters.diagnostics}
              showTreatments={filters.treatments}
            />

            <PatientEhrSupplementalSections
              patientId={patientId}
              vitalsRows={vitalsRows}
              visibleAttachments={visibleAttachments}
              prescriptions={prescriptions}
              showVitals={filters.vitals}
              showFiles={filters.files}
              showPrescriptions={filters.prescriptions}
              openingAttachmentId={openingAttachmentId}
              attachmentError={attachmentError}
              onOpenAttachment={handleOpenAttachment}
            />
            </div>
          </div>
        </main>
      </div>
    </>
  );
}
