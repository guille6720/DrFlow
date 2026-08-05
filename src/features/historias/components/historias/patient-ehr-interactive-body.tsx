"use client";

import type { ReactNode } from "react";

import { PatientEhrClinicalTables } from "@/features/historias/components/historias/patient-ehr-clinical-tables";
import { PatientEhrEvolutionPanel } from "@/features/historias/components/historias/patient-ehr-evolution-panel";
import { PatientEhrFiltersBar } from "@/features/historias/components/historias/patient-ehr-filters-bar";
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
              <PatientEhrEvolutionPanel
                patientId={patientId}
                selected={selected}
                selectedDocumentAttachment={selectedDocumentAttachment}
                openingAttachmentId={openingAttachmentId}
                onOpenAttachment={handleOpenAttachment}
              />
            ) : null}

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
        </main>
      </div>
    </>
  );
}
