"use client";

import { PatientEhrActionLinks } from "@/features/historias/components/historias/patient-ehr-action-links";
import { PatientEhrClinicalTables } from "@/features/historias/components/historias/patient-ehr-clinical-tables";
import { PatientEhrDemographics } from "@/features/historias/components/historias/patient-ehr-demographics";
import { PatientEhrEvolutionPanel } from "@/features/historias/components/historias/patient-ehr-evolution-panel";
import { PatientEhrFiltersBar } from "@/features/historias/components/historias/patient-ehr-filters-bar";
import { PatientEhrSidebar } from "@/features/historias/components/historias/patient-ehr-sidebar";
import { PatientEhrSupplementalSections } from "@/features/historias/components/historias/patient-ehr-supplemental-sections";
import type { PatientEhrViewProps } from "@/features/historias/components/historias/patient-ehr-types";
import { usePatientEhrState } from "@/features/pacientes/hooks/use-patient-ehr";

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
    <div
      className={
        embedded
          ? "drflow-ehr-shell drflow-ehr-embedded print:bg-white"
          : "drflow-ehr-shell min-h-[calc(100vh-10rem)] print:bg-white"
      }
    >
      {embedded ? null : <PatientEhrDemographics patient={patient} />}

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
