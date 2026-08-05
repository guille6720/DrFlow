"use client";

import { format } from "date-fns";
import { es } from "date-fns/locale";
import { ExternalLink, Loader2 } from "lucide-react";
import Link from "next/link";

import { withClinicalHistoryReturn } from "@/shared/utils/clinical-navigation";

import { patientEhrEvolutionBody } from "@/features/historias/components/historias/patient-ehr-utils";
import type { PatientEhrAttachment, PatientEhrConsultation } from "@/features/pacientes/utils/patient-ehr-model";

type Props = {
  patientId: string;
  selected: PatientEhrConsultation | null;
  selectedDocumentAttachment: PatientEhrAttachment | null;
  openingAttachmentId: string | null;
  onOpenAttachment: (id: string) => void;
};

export function PatientEhrEvolutionPanel({
  patientId,
  selected,
  selectedDocumentAttachment,
  openingAttachmentId,
  onOpenAttachment,
}: Props) {
  return (
    <div className="drflow-ehr-evolution-box mt-3 min-h-[240px] rounded-sm border p-4">
      {selected ? (
        <>
          <p className="mb-2 text-xs drflow-ehr-muted">
            {format(new Date(selected.created_at), "EEEE d MMMM yyyy · HH:mm", {
              locale: es,
            })}{" "}
            · {selected.professional_name}
          </p>
          <div className="min-h-[180px] whitespace-pre-wrap text-sm leading-relaxed drflow-ehr-evolution-text">
            {selected.category === "document" ? (
              <p>{selected.diagnosis?.trim() || selected.chief_complaint || "Documento adjunto"}</p>
            ) : (
              patientEhrEvolutionBody(selected)
            )}
          </div>
          {selectedDocumentAttachment ? (
            <button
              type="button"
              onClick={() => void onOpenAttachment(selectedDocumentAttachment.id)}
              disabled={openingAttachmentId === selectedDocumentAttachment.id}
              className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-teal-600 hover:underline disabled:opacity-60"
            >
              {openingAttachmentId === selectedDocumentAttachment.id ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ExternalLink className="h-4 w-4" />
              )}
              Abrir {selectedDocumentAttachment.file_name}
            </button>
          ) : null}
          {!selected.id.startsWith("hce-") ? (
            <Link
              href={withClinicalHistoryReturn(`/historias/${selected.id}`, patientId)}
              className="mt-3 inline-block text-sm font-semibold text-teal-600 hover:underline"
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
