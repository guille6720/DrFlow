"use client";

import { Printer } from "lucide-react";

import { PatientWorkspaceOverlay } from "@/features/pacientes/components/pacientes/workspace/patient-workspace-overlay";
import { MedicalOrderDocumentView } from "@/features/recetas/components/recetas/medical-order-document-view";
import { medicalOrderDocumentTitle } from "@/features/recetas/utils/medical-order-document-title";
import {
  type MedicalOrderDocumentData,
  printMedicalOrderDocument,
} from "@/features/recetas/utils/print-medical-order-document";

import { Button } from "@/components/ui/button";

type Props = {
  open: boolean;
  data: MedicalOrderDocumentData;
  onClose: () => void;
};

export function MedicalOrderPreviewSheet({ open, data, onClose }: Props) {
  const patientName = `${data.patient.last_name}, ${data.patient.first_name}`;

  return (
    <PatientWorkspaceOverlay
      open={open}
      title={`Vista previa — ${medicalOrderDocumentTitle(data.orderType)}`}
      subtitle={patientName}
      onClose={onClose}
      wide
      headerActions={
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => printMedicalOrderDocument(data)}
        >
          <Printer className="h-4 w-4" />
          Imprimir
        </Button>
      }
    >
      <MedicalOrderDocumentView data={data} />
    </PatientWorkspaceOverlay>
  );
}
