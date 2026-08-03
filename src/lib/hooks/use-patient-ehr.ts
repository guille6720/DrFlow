"use client";

import { useMemo, useState } from "react";
import { getPatientClinicalDocumentUrl } from "@/lib/actions/patient-attachments";
import { HCE_SUMMARY_ATTACHMENT_NAME } from "@/lib/utils/patient-ehr-from-hce";
import type {
  PatientEhrAttachment,
  PatientEhrConsultation,
} from "@/lib/utils/patient-ehr-model";
import {
  DEFAULT_PATIENT_EHR_FILTERS,
  type PatientEhrFilterKey,
  type PatientEhrFilters,
} from "@/components/historias/patient-ehr-types";

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

export function usePatientEhrState(
  consultations: PatientEhrConsultation[],
  attachments: PatientEhrAttachment[]
) {
  const sorted = useMemo(
    () =>
      [...consultations].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      ),
    [consultations]
  );

  const evolutionList = useMemo(() => buildEvolutionList(sorted), [sorted]);

  const [selectedId, setSelectedId] = useState<string | null>(
    evolutionList[0]?.id ?? sorted[0]?.id ?? null
  );
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

  const selected =
    sorted.find((c) => c.id === selectedId) ?? evolutionList[0] ?? sorted[0] ?? null;

  const selectedDocumentAttachment = useMemo(() => {
    if (!selected || selected.category !== "document") return null;
    const fileName = selected.diagnosis?.trim().toLowerCase();
    if (!fileName) return null;
    return attachmentByFileName.get(fileName) ?? null;
  }, [attachmentByFileName, selected]);

  const vitalsRows = useMemo(() => sorted.filter((c) => c.category === "vitals"), [sorted]);

  function toggleFilter(key: PatientEhrFilterKey) {
    setFilters((f) => ({ ...f, [key]: !f[key] }));
  }

  return {
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
  };
}
