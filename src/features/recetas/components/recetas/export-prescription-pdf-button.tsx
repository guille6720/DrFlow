"use client";

import { FileDown } from "lucide-react";

import { downloadPrescriptionPdf } from "@/features/recetas/utils/export-prescription-pdf";
import type { PrescriptionDocumentData } from "@/features/recetas/utils/print-prescription-document";

type Props = {
  data: PrescriptionDocumentData;
  compact?: boolean;
};

export function ExportPrescriptionPdfButton({ data, compact = false }: Props) {
  return (
    <button
      type="button"
      onClick={() => void downloadPrescriptionPdf(data)}
      className={
        compact
          ? "drflow-medical-order-action-btn inline-flex items-center justify-center gap-1.5 rounded-lg border border-blue-300 bg-blue-50 px-3 py-1.5 text-sm font-medium text-blue-800 hover:bg-blue-100"
          : "inline-flex items-center gap-2 rounded-lg border border-blue-300 bg-blue-50 px-3 py-1.5 text-sm font-medium text-blue-800 hover:bg-blue-100"
      }
    >
      <FileDown className="h-4 w-4" aria-hidden />
      Descargar PDF
    </button>
  );
}
