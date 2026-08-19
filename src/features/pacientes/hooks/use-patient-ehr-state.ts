"use client";

import { useCallback, useMemo, useState, useTransition } from "react";

import { toast } from "@/core/notifications/toast";

import {
  DEFAULT_PATIENT_EHR_FILTERS,
  type PatientEhrFilterKey,
  type PatientEhrFilters,
  type PatientEhrPatientInfo,
  type PatientEhrPrintScope,
} from "@/features/historias/components/historias/patient-ehr-types";
import {
  buildConsultationSidebarList,
  filterClinicalRowsByConsultationDay,
  formatPatientEhrSidebarDate,
  isSameCalendarDay,
  resolveConsultationAttachment,
  resolveSelectedConsultation,
} from "@/features/historias/components/historias/patient-ehr-utils";
import { printEhrClinicalDocument } from "@/features/historias/utils/print-ehr-clinical-document";
import { getPatientClinicalDocumentUrl } from "@/features/pacientes/actions/patient-attachments";
import type { PatientProblemListItem } from "@/features/pacientes/server/load-clinical-structure";
import { loadMorePatientClinicalRecords } from "@/features/pacientes/server/load-more-patient-clinical-records";
import { loadPatientClinicalRecordsForPrint } from "@/features/pacientes/server/load-patient-clinical-records-for-print";
import type { PatientEhrClinicalRecordsPagination } from "@/features/pacientes/server/load-patient-ehr-data";
import { HCE_SUMMARY_ATTACHMENT_NAME } from "@/features/pacientes/utils/patient-ehr-from-hce";
import type {
  PatientEhrAttachment,
  PatientEhrConsultation,
  PatientEhrDiagnosisRow,
  PatientEhrTreatmentRow,
} from "@/features/pacientes/utils/patient-ehr-model";

import type { ProfessionalSignatureSource } from "@/lib/utils/professional";
import { resolveClinicalRecordDocumentSignature } from "@/lib/utils/professional-signature-document";

function buildEvolutionList(sorted: PatientEhrConsultation[]): PatientEhrConsultation[] {
  // Mostrar toda la historia clínica: no ocultar diagnósticos/tratamientos/vitals.
  return sorted;
}

type PrintBundle = {
  patient: PatientEhrPatientInfo;
  diagnosisRows: PatientEhrDiagnosisRow[];
  treatmentRows: PatientEhrTreatmentRow[];
};

export type PatientEhrPrintClinicalContext = {
  allergies?: string | null;
  medicalHistory?: string | null;
  regularMedication?: string | null;
  sexLabel?: string | null;
  problemList?: PatientProblemListItem[];
};

function mergeById<T extends { id: string }>(base: T[], extra: T[]): T[] {
  const seen = new Set(base.map((row) => row.id));
  const merged = [...base];
  for (const row of extra) {
    if (seen.has(row.id)) continue;
    seen.add(row.id);
    merged.push(row);
  }
  return merged;
}

export function usePatientEhrState(
  consultations: PatientEhrConsultation[],
  attachments: PatientEhrAttachment[],
  printBundle: PrintBundle,
  initialSelectedId?: string | null,
  options?: {
    patientId?: string;
    clinicalRecordsPagination?: PatientEhrClinicalRecordsPagination;
    professionals?: Array<ProfessionalSignatureSource & { id?: string }>;
    clinicalContext?: PatientEhrPrintClinicalContext;
  }
) {
  const professionals = options?.professionals ?? [];
  const clinicalContext = options?.clinicalContext;
  const [extraConsultations, setExtraConsultations] = useState<PatientEhrConsultation[]>([]);
  const [extraDiagnosisRows, setExtraDiagnosisRows] = useState<PatientEhrDiagnosisRow[]>([]);
  const [extraTreatmentRows, setExtraTreatmentRows] = useState<PatientEhrTreatmentRow[]>([]);
  const [consultationDatePatches, setConsultationDatePatches] = useState<Record<string, string>>(
    {}
  );
  const [recordsPagination, setRecordsPagination] = useState<PatientEhrClinicalRecordsPagination>(
    options?.clinicalRecordsPagination ?? {
      total: consultations.length,
      hasMore: false,
      nextCursor: null,
    }
  );
  const [loadingMoreRecords, startLoadMoreRecords] = useTransition();
  const [printingFullHistory, setPrintingFullHistory] = useState(false);

  const mergedConsultations = useMemo(
    () =>
      mergeById(consultations, extraConsultations).map((row) => {
        const createdAt = consultationDatePatches[row.id];
        return createdAt ? { ...row, created_at: createdAt } : row;
      }),
    [consultations, extraConsultations, consultationDatePatches]
  );
  const mergedDiagnosisRows = useMemo(
    () =>
      mergeById(printBundle.diagnosisRows, extraDiagnosisRows).map((row) => {
        const createdAt = consultationDatePatches[row.recordId];
        return createdAt
          ? { ...row, recordCreatedAt: createdAt, dateLabel: formatPatientEhrSidebarDate(createdAt) }
          : row;
      }),
    [printBundle.diagnosisRows, extraDiagnosisRows, consultationDatePatches]
  );
  const mergedTreatmentRows = useMemo(
    () =>
      mergeById(printBundle.treatmentRows, extraTreatmentRows).map((row) => {
        const createdAt = consultationDatePatches[row.recordId];
        return createdAt
          ? { ...row, recordCreatedAt: createdAt, dateLabel: formatPatientEhrSidebarDate(createdAt) }
          : row;
      }),
    [printBundle.treatmentRows, extraTreatmentRows, consultationDatePatches]
  );

  const sorted = useMemo(
    () =>
      [...mergedConsultations].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      ),
    [mergedConsultations]
  );

  const evolutionList = useMemo(() => buildEvolutionList(sorted), [sorted]);
  const sidebarList = useMemo(
    () => buildConsultationSidebarList(sorted, evolutionList),
    [sorted, evolutionList]
  );

  const defaultSelectedId =
    sidebarList[0]?.id ?? evolutionList[0]?.id ?? sorted[0]?.id ?? null;

  const [localSelectedId, setLocalSelectedId] = useState<string | null>(defaultSelectedId);

  const selectedId = useMemo(() => {
    const fromUrl = resolveSelectedConsultation(
      initialSelectedId ?? null,
      sidebarList,
      evolutionList,
      sorted
    )?.id;
    if (fromUrl) return fromUrl;

    const fromLocal = resolveSelectedConsultation(
      localSelectedId,
      sidebarList,
      evolutionList,
      sorted
    )?.id;
    if (fromLocal) return fromLocal;

    return defaultSelectedId;
  }, [initialSelectedId, localSelectedId, sidebarList, evolutionList, sorted, defaultSelectedId]);
  const [filters, setFilters] = useState<PatientEhrFilters>(DEFAULT_PATIENT_EHR_FILTERS);
  const [openingAttachmentId, setOpeningAttachmentId] = useState<string | null>(null);
  const [attachmentError, setAttachmentError] = useState<string | null>(null);

  const visibleAttachments = useMemo(
    () => attachments.filter((a) => a.file_name !== HCE_SUMMARY_ATTACHMENT_NAME),
    [attachments]
  );

  const consultationAttachmentById = useMemo(() => {
    const map = new Map<string, PatientEhrAttachment>();
    for (const consultation of sorted) {
      const attachment = resolveConsultationAttachment(consultation, visibleAttachments);
      if (attachment) map.set(consultation.id, attachment);
    }
    return map;
  }, [sorted, visibleAttachments]);

  async function handleOpenAttachment(id: string) {
    setOpeningAttachmentId(id);
    setAttachmentError(null);
    const result = await getPatientClinicalDocumentUrl(id);
    setOpeningAttachmentId(null);
    if (result.error || !result.url) {
      const message = result.error ?? "No se pudo abrir el documento";
      setAttachmentError(message);
      toast.error(message);
      return;
    }
    window.open(result.url, "_blank", "noopener,noreferrer");
  }

  const selected = useMemo(
    () => resolveSelectedConsultation(selectedId, sidebarList, evolutionList, sorted),
    [selectedId, sidebarList, evolutionList, sorted]
  );

  const dayPrintConsultations = useMemo(() => {
    if (!selected) return [];
    return evolutionList.filter((c) => isSameCalendarDay(c.created_at, selected.created_at));
  }, [evolutionList, selected]);

  const vitalsRows = useMemo(() => sorted.filter((c) => c.category === "vitals"), [sorted]);

  const loadMoreRecords = useCallback(() => {
    if (!options?.patientId || !recordsPagination.hasMore || loadingMoreRecords) return;

    startLoadMoreRecords(async () => {
      const result = await loadMorePatientClinicalRecords(
        options.patientId!,
        recordsPagination.nextCursor ?? undefined
      );
      if (result.error) {
        toast.error(result.error);
        return;
      }

      setExtraConsultations((current) => mergeById(current, result.consultations ?? []));
      setExtraDiagnosisRows((current) => mergeById(current, result.diagnosisRows ?? []));
      setExtraTreatmentRows((current) => mergeById(current, result.treatmentRows ?? []));
      setRecordsPagination((current) => ({
        total: current.total,
        hasMore: result.hasMore ?? false,
        nextCursor: result.nextCursor ?? null,
      }));
    });
  }, [loadingMoreRecords, options, recordsPagination.hasMore, recordsPagination.nextCursor]);

  const appendClinicalHistory = useCallback(
    (payload: {
      consultations?: PatientEhrConsultation[];
      diagnosisRows?: PatientEhrDiagnosisRow[];
      treatmentRows?: PatientEhrTreatmentRow[];
    }) => {
      if (payload.consultations?.length) {
        setExtraConsultations((current) => {
          const existing = new Set(current.map((row) => row.id));
          const netNew = payload.consultations!.filter((row) => !existing.has(row.id)).length;
          if (netNew > 0) {
            setRecordsPagination((pagination) => ({
              ...pagination,
              total: pagination.total + netNew,
            }));
          }
          return mergeById(payload.consultations!, current);
        });
      }
      if (payload.diagnosisRows?.length) {
        setExtraDiagnosisRows((current) => mergeById(payload.diagnosisRows!, current));
      }
      if (payload.treatmentRows?.length) {
        setExtraTreatmentRows((current) => mergeById(payload.treatmentRows!, current));
      }
    },
    []
  );

  const patchConsultationDate = useCallback((recordId: string, createdAt: string) => {
    setConsultationDatePatches((current) => ({ ...current, [recordId]: createdAt }));
  }, []);

  async function triggerPrint(scope: PatientEhrPrintScope) {
    if (scope === "day" && dayPrintConsultations.length === 0) return;
    if (printingFullHistory) return;

    let printConsultations = evolutionList;
    let printDiagnosisRows = mergedDiagnosisRows;
    let printTreatmentRows = mergedTreatmentRows;

    if (scope === "all" && recordsPagination.hasMore && options?.patientId) {
      setPrintingFullHistory(true);
      try {
        const result = await loadPatientClinicalRecordsForPrint(options.patientId);
        if (result.error) {
          toast.error(result.error);
          return;
        }

        printConsultations = result.consultations ?? [];
        printDiagnosisRows = result.diagnosisRows ?? [];
        printTreatmentRows = result.treatmentRows ?? [];

        setExtraConsultations((current) => mergeById(current, printConsultations));
        setExtraDiagnosisRows((current) => mergeById(current, printDiagnosisRows));
        setExtraTreatmentRows((current) => mergeById(current, printTreatmentRows));
        setRecordsPagination((current) => ({
          total: Math.max(current.total, printConsultations.length),
          hasMore: result.truncated === true,
          nextCursor: result.truncated === true ? current.nextCursor : null,
        }));

        if (result.truncated) {
          toast.info(
            `La impresión incluye las últimas ${printConsultations.length} evoluciones (límite de seguridad).`
          );
        }
      } finally {
        setPrintingFullHistory(false);
      }
    }

    const dayCreatedAt = selected?.created_at ?? dayPrintConsultations[0]?.created_at ?? null;
    const diagnosisRows =
      scope === "day"
        ? filterClinicalRowsByConsultationDay(printDiagnosisRows, dayCreatedAt)
        : printDiagnosisRows;
    const treatmentRows =
      scope === "day"
        ? filterClinicalRowsByConsultationDay(printTreatmentRows, dayCreatedAt)
        : printTreatmentRows;

    const result = printEhrClinicalDocument({
      scope,
      patient: printBundle.patient,
      consultations: printConsultations,
      dayConsultations: dayPrintConsultations,
      diagnosisRows,
      treatmentRows,
      professionals,
      clinicalContext,
    });

    if (!result.ok) {
      toast.error(result.message);
    }
  }

  function toggleFilter(key: PatientEhrFilterKey) {
    setFilters((f) => ({ ...f, [key]: !f[key] }));
  }

  function resolveConsultationSignature(consultation: PatientEhrConsultation) {
    return resolveClinicalRecordDocumentSignature({
      professionalId: consultation.professional_id,
      storedSignatureText: consultation.professional_signature,
      professionals,
    });
  }

  return {
    evolutionList,
    sidebarList,
    selectedId,
    setSelectedId: setLocalSelectedId,
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
    triggerPrint,
    printingFullHistory,
    diagnosisRows: mergedDiagnosisRows,
    treatmentRows: mergedTreatmentRows,
    clinicalRecordsPagination: recordsPagination,
    loadMoreRecords,
    loadingMoreRecords,
    appendClinicalHistory,
    patchConsultationDate,
    resolveConsultationSignature,
    patientId: options?.patientId ?? printBundle.patient.id,
  };
}
