"use client";

import { Eye, Printer } from "lucide-react";
import { useState } from "react";

import { MedicalOrderPreviewSheet } from "@/features/recetas/components/recetas/medical-order-preview-sheet";
import {
  type MedicalOrderDocumentData,
  printMedicalOrderDocument,
} from "@/features/recetas/utils/print-medical-order-document";

import { Button } from "@/components/ui/button";

type Props = {
  data: MedicalOrderDocumentData;
  disabled?: boolean;
};

export function MedicalOrderActions({ data, disabled = false }: Props) {
  const [previewOpen, setPreviewOpen] = useState(false);

  if (disabled) return null;

  return (
    <>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button type="button" size="sm" variant="outline" onClick={() => setPreviewOpen(true)}>
          <Eye className="h-4 w-4" />
          Vista previa
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={() => printMedicalOrderDocument(data)}>
          <Printer className="h-4 w-4" />
          Imprimir
        </Button>
      </div>

      <MedicalOrderPreviewSheet
        open={previewOpen}
        data={data}
        onClose={() => setPreviewOpen(false)}
      />
    </>
  );
}
