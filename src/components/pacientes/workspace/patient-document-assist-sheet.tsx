"use client";

import { useState } from "react";
import { PatientWorkspaceOverlay } from "@/components/pacientes/workspace/patient-workspace-overlay";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { InlinePhysicianAssist } from "@/components/clinical-workflow/inline-physician-assist";
import type { PhysicianAssistContext, PhysicianAssistItem } from "@/lib/utils/physician-assist-types";
import { useFeatureFlag } from "@/components/plugins/clinic-plugins-provider";

type DocKind = "discharge_summary" | "medical_certificate";

type Props = {
  open: boolean;
  kind: DocKind;
  title: string;
  patientName: string;
  context: PhysicianAssistContext;
  onClose: () => void;
};

export function PatientDocumentAssistSheet({
  open,
  kind,
  title,
  patientName,
  context,
  onClose,
}: Props) {
  const enabled = useFeatureFlag("consultation_assistant");
  const [body, setBody] = useState("");

  function handleApply(item: PhysicianAssistItem) {
    setBody(item.body);
  }

  return (
    <PatientWorkspaceOverlay
      open={open}
      title={title}
      subtitle={patientName}
      onClose={onClose}
      wide
    >
      <div className="space-y-4">
        {enabled ? (
          <InlinePhysicianAssist
            context={{ ...context, patientName }}
            kinds={[kind, "interaction_alert"]}
            onApply={handleApply}
          />
        ) : null}

        <Textarea
          label="Texto del documento (editar antes de usar)"
          rows={16}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          voiceInput
          placeholder="Generá un borrador con asistencia clínica o escribí manualmente."
        />

        <p className="text-xs text-slate-500">
          El documento no se guarda automáticamente. Copiá, imprimí o pegá en la evolución después de
          revisar y firmar.
        </p>

        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={!body.trim()}
            onClick={() => void navigator.clipboard.writeText(body)}
          >
            Copiar texto
          </Button>
          <Button type="button" variant="ghost" onClick={onClose}>
            Cerrar
          </Button>
        </div>
      </div>
    </PatientWorkspaceOverlay>
  );
}
