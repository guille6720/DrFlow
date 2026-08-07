"use client";

import { Eye, Printer } from "lucide-react";

import {
  type PrescriptionDocumentData,
  printPrescriptionDocument,
} from "@/features/recetas/utils/print-prescription-document";

type Props = {
  data: PrescriptionDocumentData;
  onPreview: () => void;
  compact?: boolean;
};

export function PrescriptionDocumentActions({ data, onPreview, compact = false }: Props) {
  return (
    <div
      className={
        compact
          ? "drflow-medical-order-actions flex shrink-0 flex-col items-stretch gap-2 sm:min-w-[9.5rem]"
          : "drflow-medical-order-actions mt-3 flex flex-wrap items-center gap-2"
      }
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        onClick={onPreview}
        className="drflow-medical-order-action-btn inline-flex items-center justify-center gap-1.5 rounded-lg border border-blue-300 bg-blue-50 px-3 py-1.5 text-sm font-medium text-blue-900 hover:bg-blue-100"
      >
        <Eye className="h-4 w-4" aria-hidden />
        Vista previa
      </button>
      <button
        type="button"
        onClick={() => printPrescriptionDocument(data)}
        className="drflow-medical-order-action-btn inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-800 hover:bg-slate-50"
      >
        <Printer className="h-4 w-4" aria-hidden />
        Imprimir
      </button>
    </div>
  );
}
