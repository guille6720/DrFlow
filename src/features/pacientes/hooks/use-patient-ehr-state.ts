"use client";

import { useMemo, useState } from "react";

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
  isSameCalendarDay,
  resolveSelectedConsultation,
} from "@/features/historias/components/historias/patient-ehr-utils";
import { printEhrClinicalDocument } from "@/features/historias/utils/print-ehr-clinical-document";
import { getPatientClinicalDocumentUrl } from "@/features/pacientes/actions/patient-attachments";
import { HCE_SUMMARY_ATTACHMENT_NAME } from "@/features/pacientes/utils/patient-ehr-from-hce";
import type {
  PatientEhrAttachment,
  PatientEhrConsultation,
  PatientEhrDiagnosisRow,
  PatientEhrTreatmentRow,
} from "@/features/pacientes/utils/patient-ehr-model";

function buildEvolutionList(sorted: PatientEhrConsultation[]): PatientEhrConsultation[] {
  const withText = sorted.filter(
    (c) =>
      c.category === "evolution" ||
      (c.evolution?.trim().length ?? 0) > 15 ||
      (c.category !== "vitals" &&
        c.category !== "treatment" &&
        c.category !== "diagnostic" &&
        (c.chief_complaint?.trim().length ?? 0) > 20)
  );
  return withText.length > 0 ? withText : sorted.filter((c) => c.category === "evolution");
}

type PrintBundle = {
  patient: PatientEhrPatientInfo;
  diagnosisRows: PatientEhrDiagnosisRow[];
  treatmentRows: PatientEhrTreatmentRow[];
};

export function usePatientEhrState(
  consultations: PatientEhrConsultation[],
  attachments: PatientEhrAttachment[],
  printBundle: PrintBundle,
  initialSelectedId?: string | null
) {
  const sorted = useMemo(
    () =>
      [...consultations].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      ),
    [consultations]
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

  const attachmentByFileName = useMemo(() => {
    const map = new Map<string, PatientEhrAttachment>();
    for (const attachment of visibleAttachments) {
      map.set(attachment.file_name.toLowerCase(), attachment);
    }
    return map;
  }, [visibleAttachments]);

  async function handleOpenAttachment(id: string) {
    setOpeningAttachmentId(id);
    setAttachmentError(null);
    const result = await getPatientClinicalDocumentUrl(id);
    setOpeningAttachmentId(null);
    if (result.error || !result.url) {
      setAttachmentError(result.error ?? "No se pudo abrir el documento");
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

  const selectedDocumentAttachment = useMemo(() => {
    if (!selected || selected.category !== "document") return null;
    const fileName = selected.diagnosis?.trim().toLowerCase();
    if (!fileName) return null;
    return attachmentByFileName.get(fileName) ?? null;
  }, [attachmentByFileName, selected]);

  const vitalsRows = useMemo(() => sorted.filter((c) => c.category === "vitals"), [sorted]);

  function triggerPrint(scope: PatientEhrPrintScope) {
    if (scope === "day" && dayPrintConsultations.length === 0) return;

    const result = printEhrClinicalDocument({
      scope,
      patient: printBundle.patient,
      consultations: evolutionList,
      dayConsultations: dayPrintConsultations,
      diagnosisRows: printBundle.diagnosisRows,
      treatmentRows: printBundle.treatmentRows,
    });

    if (!result.ok) {
      toast.error(result.message);
    }
  }

  function toggleFilter(key: PatientEhrFilterKey) {
    setFilters((f) => ({ ...f, [key]: !f[key] }));
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
    selectedDocumentAttachment,
    vitalsRows,
    dayPrintConsultations,
    triggerPrint,
  };
}
