"use client";

import { useState } from "react";

import { MedicalOrderActionButtons } from "@/features/recetas/components/recetas/medical-order-action-buttons";
import { MedicalOrderPreviewSheet } from "@/features/recetas/components/recetas/medical-order-preview-sheet";
import type { MedicalOrderDocumentData } from "@/features/recetas/utils/print-medical-order-document";

type Props = {
  data: MedicalOrderDocumentData;
  disabled?: boolean;
};

export function MedicalOrderActions({ data, disabled = false }: Props) {
  const [previewOpen, setPreviewOpen] = useState(false);

  if (disabled) return null;

  return (
    <>
      <MedicalOrderActionButtons
        data={data}
        onPreview={() => setPreviewOpen(true)}
      />
      <MedicalOrderPreviewSheet
        open={previewOpen}
        data={data}
        onClose={() => setPreviewOpen(false)}
      />
    </>
  );
}
