"use client";

import { ExternalLink, Loader2 } from "lucide-react";
import Link from "next/link";

import { withClinicalHistoryReturn } from "@/shared/utils/clinical-navigation";

import { PatientEhrConsultationDateEditor } from "@/features/historias/components/historias/patient-ehr-consultation-date-editor";
import {
  extractConsultationFileName,
  formatPatientEhrSidebarDate,
  patientEhrEvolutionBody,
} from "@/features/historias/components/historias/patient-ehr-utils";
import type { PatientEhrAttachment, PatientEhrConsultation } from "@/features/pacientes/utils/patient-ehr-model";

type Props = {
  patientId: string;
  selected: PatientEhrConsultation | null;
  documentAttachment: PatientEhrAttachment | null;
  openingAttachmentId: string | null;
  attachmentError?: string | null;
  onOpenAttachment: (id: string) => void;
};

export function PatientEhrEvolutionPanel({
  patientId,
  selected,
  documentAttachment,
  openingAttachmentId,
  attachmentError = null,
  onOpenAttachment,
}: Props) {
  const referencedFileName = selected ? extractConsultationFileName(selected) : null;

  return (
    <div className="drflow-ehr-evolution-box mt-3 min-h-[240px] rounded-sm border p-4">
      {selected ? (
        <>
          <div className="mb-2 flex flex-wrap items-center gap-2 text-xs drflow-ehr-muted">
            {!selected.id.startsWith("hce-") ? (
              <PatientEhrConsultationDateEditor
                recordId={selected.id}
                createdAt={selected.created_at}
              />
            ) : (
              <span>{formatPatientEhrSidebarDate(selected.created_at)}</span>
            )}
            <span>· {selected.professional_name}</span>
          </div>
          <div className="min-h-[180px] whitespace-pre-wrap text-sm leading-relaxed drflow-ehr-evolution-text">
            {selected.category === "document" && referencedFileName ? (
              <p>{referencedFileName}</p>
            ) : (
              patientEhrEvolutionBody(selected)
            )}
          </div>
          {documentAttachment ? (
            <button
              type="button"
              onClick={() => void onOpenAttachment(documentAttachment.id)}
              disabled={openingAttachmentId === documentAttachment.id}
              className="drflow-ehr-action-link mt-3 inline-flex items-center gap-2 text-sm font-semibold hover:underline disabled:opacity-60"
            >
              {openingAttachmentId === documentAttachment.id ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ExternalLink className="h-4 w-4" />
              )}
              Abrir {documentAttachment.file_name}
            </button>
          ) : referencedFileName ? (
            <p className="mt-3 text-sm drflow-ehr-muted">
              Archivo no disponible en el sistema ({referencedFileName}).
            </p>
          ) : null}
          {attachmentError ? (
            <p className="mt-2 text-xs text-red-600">{attachmentError}</p>
          ) : null}
          {!selected.id.startsWith("hce-") ? (
            <Link
              href={withClinicalHistoryReturn(`/historias/${selected.id}`, patientId)}
              className="drflow-ehr-action-link mt-3 inline-block text-sm font-semibold hover:underline"
            >
              Abrir consulta completa →
            </Link>
          ) : null}
        </>
      ) : (
        <p className="text-sm drflow-ehr-muted">Seleccioná una evolución del listado.</p>
      )}
    </div>
  );
}
