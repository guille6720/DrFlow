"use client";

import { Printer } from "lucide-react";

import { PatientWorkspaceOverlay } from "@/features/pacientes/components/pacientes/workspace/patient-workspace-overlay";
import { PrescriptionDocumentView } from "@/features/recetas/components/recetas/prescription-document-view";
import {
  type PrescriptionDocumentData,
  printPrescriptionDocument,
} from "@/features/recetas/utils/print-prescription-document";

import { Button } from "@/components/ui/button";

type Props = {
  open: boolean;
  data: PrescriptionDocumentData;
  onClose: () => void;
};

export function PrescriptionPreviewSheet({ open, data, onClose }: Props) {
  const patientName = `${data.patient.last_name}, ${data.patient.first_name}`;

  return (
    <PatientWorkspaceOverlay
      open={open}
      title="Vista previa — Receta local / borrador"
      subtitle={patientName}
      onClose={onClose}
      wide
      headerActions={
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => printPrescriptionDocument(data)}
        >
          <Printer className="h-4 w-4" />
          Imprimir
        </Button>
      }
    >
      <PrescriptionDocumentView data={data} />
    </PatientWorkspaceOverlay>
  );
}
