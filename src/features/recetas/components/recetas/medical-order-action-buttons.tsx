"use client";

import { Eye, Printer } from "lucide-react";

import {
  type MedicalOrderDocumentData,
  printMedicalOrderDocument,
} from "@/features/recetas/utils/print-medical-order-document";

type Props = {
  data: MedicalOrderDocumentData;
  onPreview: () => void;
  compact?: boolean;
};

export function MedicalOrderActionButtons({ data, onPreview, compact = false }: Props) {
  return (
    <div
      className={
        compact
          ? "drflow-medical-order-actions flex shrink-0 flex-wrap items-center gap-2"
          : "drflow-medical-order-actions mt-3 flex flex-wrap items-center gap-2"
      }
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        onClick={onPreview}
        className="drflow-medical-order-action-btn inline-flex items-center gap-1.5 rounded-lg border border-blue-300 bg-blue-50 px-3 py-1.5 text-sm font-medium text-blue-900 hover:bg-blue-100"
      >
        <Eye className="h-4 w-4" aria-hidden />
        Vista previa
      </button>
      <button
        type="button"
        onClick={() => printMedicalOrderDocument(data)}
        className="drflow-medical-order-action-btn inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-800 hover:bg-slate-50"
      >
        <Printer className="h-4 w-4" aria-hidden />
        Imprimir
      </button>
    </div>
  );
}
