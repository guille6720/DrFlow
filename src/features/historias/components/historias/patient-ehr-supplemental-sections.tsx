"use client";

import { format } from "date-fns";
import { es } from "date-fns/locale";
import { ExternalLink, Loader2 } from "lucide-react";

import type {
  PatientEhrAttachment,
  PatientEhrConsultation,
  PatientEhrPrescription,
} from "@/features/pacientes/utils/patient-ehr-model";

import { sanitizeClinicalDisplayText } from "@/lib/utils/sanitize-clinical-display";

type Props = {
  vitalsRows: PatientEhrConsultation[];
  visibleAttachments: PatientEhrAttachment[];
  prescriptions: PatientEhrPrescription[];
  showVitals: boolean;
  showFiles: boolean;
  showPrescriptions: boolean;
  openingAttachmentId: string | null;
  attachmentError: string | null;
  onOpenAttachment: (id: string) => void;
};

export function PatientEhrSupplementalSections({
  vitalsRows,
  visibleAttachments,
  prescriptions,
  showVitals,
  showFiles,
  showPrescriptions,
  openingAttachmentId,
  attachmentError,
  onOpenAttachment,
}: Props) {
  return (
    <>
      {showVitals && vitalsRows.length > 0 ? (
        <section className="mt-4 drflow-ehr-table-panel overflow-hidden rounded-sm border border-[var(--border)]">
          <h3 className="drflow-ehr-table-title border-b border-[var(--border)] px-3 py-2 text-sm font-bold">
            Signos vitales
          </h3>
          <ul className="divide-y divide-[var(--border)] text-xs">
            {vitalsRows.map((c) => (
              <li key={c.id} className="px-3 py-2">
                <span className="font-semibold">
                  {format(new Date(c.created_at), "d MMM yyyy", { locale: es })}
                </span>
                {" — "}
                {sanitizeClinicalDisplayText(c.evolution || c.chief_complaint) || "—"}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {showFiles && visibleAttachments.length > 0 ? (
        <section className="mt-4 drflow-ehr-table-panel overflow-hidden rounded-sm border border-[var(--border)]">
          <h3 className="drflow-ehr-table-title border-b border-[var(--border)] px-3 py-2 text-sm font-bold">
            Archivos
          </h3>
          {attachmentError ? (
            <p className="border-b border-[var(--border)] px-3 py-2 text-xs text-red-600">
              {attachmentError}
            </p>
          ) : null}
          <ul className="divide-y divide-[var(--border)] text-xs">
            {visibleAttachments.map((a) => (
              <li key={a.id} className="px-3 py-2">
                <button
                  type="button"
                  onClick={() => void onOpenAttachment(a.id)}
                  disabled={openingAttachmentId === a.id}
                  className="drflow-ehr-action-link inline-flex items-center gap-2 font-medium hover:underline disabled:opacity-60"
                >
                  {openingAttachmentId === a.id ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <ExternalLink className="h-3.5 w-3.5" />
                  )}
                  {a.file_name}
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {showPrescriptions && prescriptions.length > 0 ? (
        <section className="mt-4 drflow-ehr-table-panel overflow-hidden rounded-sm border border-[var(--border)]">
          <h3 className="drflow-ehr-table-title border-b border-[var(--border)] px-3 py-2 text-sm font-bold">
            Recetas
          </h3>
          <ul className="divide-y divide-[var(--border)] text-xs">
            {prescriptions.map((p) => (
              <li key={p.id} className="px-3 py-2">
                {p.label}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </>
  );
}
