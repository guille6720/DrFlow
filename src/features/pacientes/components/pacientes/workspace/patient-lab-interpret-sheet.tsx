"use client";

import { useState } from "react";
import { PatientWorkspaceOverlay } from "@/features/pacientes/components/pacientes/workspace/patient-workspace-overlay";
import { LabInterpretationPanel } from "@/features/ia/components/clinical-workflow/lab-interpretation-panel";
import { Button } from "@/components/ui/button";
import type { PatientChartExtras } from "@/features/pacientes/utils/patient-chart-model-types";

type Props = {
  open: boolean;
  patientName: string;
  previousLabs?: PatientChartExtras["labs"];
  onClose: () => void;
};

export function PatientLabInterpretSheet({ open, patientName, previousLabs, onClose }: Props) {
  const [sourceText, setSourceText] = useState("");

  return (
    <PatientWorkspaceOverlay
      open={open}
      title="Interpretar laboratorio"
      subtitle={patientName}
      onClose={onClose}
      wide
    >
      <LabInterpretationPanel
        previousLabs={previousLabs}
        sourceText={sourceText}
        onSourceTextChange={setSourceText}
      />
      <div className="mt-4 flex gap-2">
        <Button type="button" variant="ghost" onClick={onClose}>
          Cerrar
        </Button>
      </div>
    </PatientWorkspaceOverlay>
  );
}
