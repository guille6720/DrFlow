"use client";

import { PatientEhrActionLinks } from "@/components/historias/patient-ehr-action-links";
import { PatientEhrClinicalTables } from "@/components/historias/patient-ehr-clinical-tables";
import { PatientEhrDemographics } from "@/components/historias/patient-ehr-demographics";
import { PatientEhrEvolutionPanel } from "@/components/historias/patient-ehr-evolution-panel";
import { PatientEhrFiltersBar } from "@/components/historias/patient-ehr-filters-bar";
import { PatientEhrSidebar } from "@/components/historias/patient-ehr-sidebar";
import { PatientEhrSupplementalSections } from "@/components/historias/patient-ehr-supplemental-sections";
import type { PatientEhrViewProps } from "@/components/historias/patient-ehr-types";
import { usePatientEhrState } from "@/lib/hooks/use-patient-ehr";

export function PatientEhrView({
  patient,
  consultations,
  diagnosisRows,
  treatmentRows,
  attachments,
  prescriptions,
  totalConsultations,
  usesHceExport = false,
}: PatientEhrViewProps) {
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
  } = usePatientEhrState(consultations, attachments);

  return (
    <div className="drflow-ehr-shell min-h-[calc(100vh-10rem)] print:bg-white">
      <PatientEhrDemographics patient={patient} />

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
            <PatientEhrActionLinks patientId={patient.id} />

            {filters.evolutions ? (
              <PatientEhrEvolutionPanel
                patientId={patient.id}
                selected={selected}
                selectedDocumentAttachment={selectedDocumentAttachment}
                openingAttachmentId={openingAttachmentId}
                onOpenAttachment={handleOpenAttachment}
              />
            ) : null}

            <PatientEhrClinicalTables
              patientId={patient.id}
              diagnosisRows={diagnosisRows}
              treatmentRows={treatmentRows}
              showDiagnostics={filters.diagnostics}
              showTreatments={filters.treatments}
            />

            <PatientEhrSupplementalSections
              patientId={patient.id}
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
    </div>
  );
}
