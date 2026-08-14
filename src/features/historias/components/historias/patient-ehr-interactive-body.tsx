"use client";

import { useRouter } from "next/navigation";
import { type ReactNode, useMemo } from "react";

import { PatientEhrClinicalTables } from "@/features/historias/components/historias/patient-ehr-clinical-tables";
import { PatientEhrEvolutionPanel } from "@/features/historias/components/historias/patient-ehr-evolution-panel";
import { PatientEhrFiltersBar } from "@/features/historias/components/historias/patient-ehr-filters-bar";
import { PatientEhrPrintClinicalTables } from "@/features/historias/components/historias/patient-ehr-print-clinical-tables";
import { PatientEhrPrintEvolutionBlock } from "@/features/historias/components/historias/patient-ehr-print-evolution-block";
import { PatientEhrSidebar } from "@/features/historias/components/historias/patient-ehr-sidebar";
import { usePatientEhrStateContext } from "@/features/historias/components/historias/patient-ehr-state-context";
import { PatientEhrSupplementalSections } from "@/features/historias/components/historias/patient-ehr-supplemental-sections";
import {
  filterClinicalRowsByConsultationDay,
  filterConsultationsByConsultationDay,
} from "@/features/historias/components/historias/patient-ehr-utils";
import { PatientProblemListPanel } from "@/features/historias/components/historias/patient-problem-list-panel";
import type { PatientProblemListItem } from "@/features/pacientes/server/load-clinical-structure";
import type {
  PatientEhrDiagnosisRow,
  PatientEhrPrescription,
  PatientEhrTreatmentRow,
} from "@/features/pacientes/utils/patient-ehr-model";
import type {
  PatientWorkspaceFocus,
  PatientWorkspaceSheet,
} from "@/features/pacientes/utils/patient-workspace-actions";
import { buildPatientWorkspaceUrl } from "@/features/pacientes/utils/patient-workspace-actions";

type Props = {
  patientId: string;
  diagnosisRows: PatientEhrDiagnosisRow[];
  treatmentRows: PatientEhrTreatmentRow[];
  problemList?: PatientProblemListItem[];
  prescriptions: PatientEhrPrescription[];
  totalConsultations: number;
  usesHceExport?: boolean;
  actionLinks: ReactNode;
  inlineConsultOpen?: boolean;
  canIssue?: boolean;
  pendingSidebarConsultation?: {
    createdAt: string;
    professionalName: string;
  } | null;
  consultPanel?: ReactNode;
  buildConsultHref?: (opts?: {
    sheet?: PatientWorkspaceSheet;
    focus?: PatientWorkspaceFocus;
    consulta?: string;
  }) => string;
};

export function PatientEhrInteractiveBody({
  patientId,
  diagnosisRows: _diagnosisRows,
  treatmentRows: _treatmentRows,
  problemList = [],
  prescriptions,
  totalConsultations,
  usesHceExport = false,
  actionLinks,
  inlineConsultOpen = false,
  canIssue = false,
  pendingSidebarConsultation = null,
  consultPanel,
  buildConsultHref,
}: Props) {
  const router = useRouter();
  const {
    evolutionList,
    sidebarList,
    selectedId,
    setSelectedId,
    filters,
    toggleFilter,
    openingAttachmentId,
    attachmentError,
    visibleAttachments,
    handleOpenAttachment,
    selected,
    consultationAttachmentById,
    vitalsRows,
    dayPrintConsultations,
    diagnosisRows: mergedDiagnosisRows,
    treatmentRows: mergedTreatmentRows,
    clinicalRecordsPagination,
    loadMoreRecords,
    loadingMoreRecords,
    resolveConsultationSignature,
  } = usePatientEhrStateContext();

  function handleSidebarSelect(id: string) {
    setSelectedId(id);
    if (inlineConsultOpen && buildConsultHref) {
      // Stay in the in-progress consult form; don't jump to a past evolution URL.
      return;
    }
    const url = buildPatientWorkspaceUrl(patientId, { tab: "soap", consulta: id });
    if (inlineConsultOpen) {
      router.push(url, { scroll: false });
      return;
    }
    router.replace(url, { scroll: false });
  }

  const screenDayConsultations =
    dayPrintConsultations.length > 0 ? dayPrintConsultations : selected ? [selected] : [];

  const screenDiagnosisRows = useMemo(() => {
    if (!filters.evolutions || inlineConsultOpen || !selected) return mergedDiagnosisRows;
    return filterClinicalRowsByConsultationDay(mergedDiagnosisRows, selected.created_at);
  }, [mergedDiagnosisRows, filters.evolutions, inlineConsultOpen, selected]);

  const screenTreatmentRows = useMemo(() => {
    if (!filters.evolutions || inlineConsultOpen || !selected) return mergedTreatmentRows;
    return filterClinicalRowsByConsultationDay(mergedTreatmentRows, selected.created_at);
  }, [mergedTreatmentRows, filters.evolutions, inlineConsultOpen, selected]);

  const screenVitalsRows = useMemo(() => {
    if (!filters.evolutions || inlineConsultOpen || !selected) return vitalsRows;
    return filterConsultationsByConsultationDay(vitalsRows, selected.created_at);
  }, [vitalsRows, filters.evolutions, inlineConsultOpen, selected]);

  return (
    <>
      <PatientEhrFiltersBar
        filters={filters}
        onToggleFilter={toggleFilter}
        totalConsultations={totalConsultations}
        usesHceExport={usesHceExport}
      />

      <div className="drflow-ehr-layout flex min-h-0 flex-1 flex-col lg:flex-row lg:items-stretch">
        {filters.evolutions ? (
          <PatientEhrSidebar
            sidebarList={sidebarList}
            selectedId={selectedId}
            pendingConsultation={pendingSidebarConsultation}
            onSelect={handleSidebarSelect}
            hasMoreRecords={clinicalRecordsPagination.hasMore}
            loadingMoreRecords={loadingMoreRecords}
            onLoadMoreRecords={loadMoreRecords}
            loadedRecordsCount={sidebarList.length}
            totalRecordsCount={clinicalRecordsPagination.total}
          />
        ) : null}

        <main className="drflow-ehr-main min-w-0 flex-1">
          <div className="p-4">
            {actionLinks}

            {inlineConsultOpen && consultPanel ? (
              <div className="drflow-ehr-screen-only">{consultPanel}</div>
            ) : filters.evolutions ? (
              <>
                <div className="drflow-ehr-screen-only mt-3 space-y-3">
                  {screenDayConsultations.map((consultation) => (
                    <PatientEhrEvolutionPanel
                      key={consultation.id}
                      patientId={patientId}
                      selected={consultation}
                      canIssue={canIssue}
                      documentAttachment={consultationAttachmentById.get(consultation.id) ?? null}
                      openingAttachmentId={openingAttachmentId}
                      attachmentError={attachmentError}
                      onOpenAttachment={handleOpenAttachment}
                    />
                  ))}
                </div>

                <div className="drflow-ehr-print-only drflow-ehr-print-day-content mt-3 space-y-3">
                  {dayPrintConsultations.map((consultation) => (
                    <PatientEhrPrintEvolutionBlock
                      key={consultation.id}
                      consultation={consultation}
                      signature={resolveConsultationSignature(consultation)}
                    />
                  ))}
                </div>

                <div className="drflow-ehr-print-only drflow-ehr-print-all-content mt-3 space-y-3">
                  {evolutionList.map((consultation) => (
                    <PatientEhrPrintEvolutionBlock
                      key={consultation.id}
                      consultation={consultation}
                      signature={resolveConsultationSignature(consultation)}
                    />
                  ))}
                </div>
              </>
            ) : null}

            <div className="drflow-ehr-print-supplemental">
              <div className="drflow-ehr-screen-only">
                {filters.diagnostics ? (
                  <PatientProblemListPanel patientId={patientId} problems={problemList} />
                ) : null}
                <PatientEhrClinicalTables
                  patientId={patientId}
                  diagnosisRows={screenDiagnosisRows}
                  treatmentRows={screenTreatmentRows}
                  showDiagnostics={filters.diagnostics}
                  showTreatments={filters.treatments}
                />

                <PatientEhrSupplementalSections
                  vitalsRows={screenVitalsRows}
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

              <div className="drflow-ehr-print-only drflow-ehr-print-tables-wrap">
                <PatientEhrPrintClinicalTables
                  diagnosisRows={filters.diagnostics ? screenDiagnosisRows : []}
                  treatmentRows={filters.treatments ? screenTreatmentRows : []}
                  consultations={evolutionList}
                />
              </div>
            </div>
          </div>
        </main>
      </div>
    </>
  );
}
