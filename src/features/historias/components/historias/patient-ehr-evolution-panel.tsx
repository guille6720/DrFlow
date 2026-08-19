"use client";

import { ExternalLink, Loader2, Plus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { toast } from "@/core/notifications/toast";

import { updateClinicalRecordNotes } from "@/features/historias/actions/clinical-records";
import { PatientEhrConsultationDateEditor } from "@/features/historias/components/historias/patient-ehr-consultation-date-editor";
import {
  extractConsultationFileName,
  formatPatientEhrSidebarDate,
  patientEhrEvolutionBody,
} from "@/features/historias/components/historias/patient-ehr-utils";
import type { PatientEhrAttachment, PatientEhrConsultation } from "@/features/pacientes/utils/patient-ehr-model";
import { buildPatientWorkspaceUrl } from "@/features/pacientes/utils/patient-workspace-actions";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

type Props = {
  patientId: string;
  selected: PatientEhrConsultation | null;
  documentAttachment: PatientEhrAttachment | null;
  openingAttachmentId: string | null;
  attachmentError?: string | null;
  onOpenAttachment: (id: string) => void;
  canIssue?: boolean;
  editing?: boolean;
  onStartEdit?: () => void;
  onStopEdit?: () => void;
};

type EditorProps = {
  selected: PatientEhrConsultation;
  onCancel: () => void;
  onSaved: () => void;
};

function EvolutionNotesEditor({ selected, onCancel, onSaved }: EditorProps) {
  const [chiefComplaint, setChiefComplaint] = useState(selected.chief_complaint ?? "");
  const [evolution, setEvolution] = useState(
    selected.evolution || patientEhrEvolutionBody(selected)
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setSaving(true);
    setError(null);
    const result = await updateClinicalRecordNotes(selected.id, {
      chief_complaint: chiefComplaint,
      evolution,
      diagnosis: selected.diagnosis,
      indications: selected.indications,
    });
    setSaving(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    toast.success("Evolución actualizada");
    onSaved();
  }

  return (
    <div className="space-y-3">
      <Textarea
        label="Motivo de consulta"
        rows={2}
        value={chiefComplaint}
        onChange={(e) => setChiefComplaint(e.target.value)}
      />
      <Textarea
        label="Evolución"
        rows={10}
        value={evolution}
        onChange={(e) => setEvolution(e.target.value)}
      />
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
      <div className="flex justify-end gap-2">
        <Button type="button" size="sm" variant="outline" disabled={saving} onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="button" size="sm" loading={saving} onClick={() => void handleSave()}>
          Guardar
        </Button>
      </div>
    </div>
  );
}

export function PatientEhrEvolutionPanel({
  patientId,
  selected,
  documentAttachment,
  openingAttachmentId,
  attachmentError = null,
  onOpenAttachment,
  canIssue = false,
  editing = false,
  onStartEdit,
  onStopEdit,
}: Props) {
  const router = useRouter();
  const referencedFileName = selected ? extractConsultationFileName(selected) : null;
  const canEdit = Boolean(selected && !selected.id.startsWith("hce-") && onStartEdit);

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
            {canEdit && !editing ? (
              <button
                type="button"
                onClick={onStartEdit}
                className="drflow-ehr-action-link font-semibold hover:underline"
              >
                Editar
              </button>
            ) : null}
            {canIssue && !selected.id.startsWith("hce-") ? (
              <Link
                href={buildPatientWorkspaceUrl(patientId, {
                  tab: "soap",
                  consulta: selected.id,
                  sheet: "receta",
                })}
                className="ml-auto inline-flex items-center gap-1 rounded-md bg-teal-600 px-2 py-1 text-xs font-semibold text-white hover:bg-teal-700"
              >
                <Plus className="h-3 w-3" />
                Nueva receta
              </Link>
            ) : null}
          </div>
          {editing ? (
            <EvolutionNotesEditor
              key={selected.id}
              selected={selected}
              onCancel={() => onStopEdit?.()}
              onSaved={() => {
                onStopEdit?.();
                router.refresh();
              }}
            />
          ) : (
            <div className="min-h-[180px] whitespace-pre-wrap text-sm leading-relaxed drflow-ehr-evolution-text">
              {selected.category === "document" && referencedFileName ? (
                <p>{referencedFileName}</p>
              ) : (
                patientEhrEvolutionBody(selected)
              )}
            </div>
          )}
          {documentAttachment ? (
            <button
              type="button"
              onClick={() => void onOpenAttachment(documentAttachment.id)}
              disabled={openingAttachmentId === documentAttachment.id}
              className="drflow-ehr-action-link mt-3 inline-flex items-center gap-2 text-sm font-semibold hover:underline disabled:text-slate-400"
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
        </>
      ) : (
        <p className="text-sm drflow-ehr-muted">Seleccioná una evolución del listado.</p>
      )}
    </div>
  );
}
