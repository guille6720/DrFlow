"use client";

import { Eye, Pencil, Printer, Trash2 } from "lucide-react";

import {
  type MedicalOrderDocumentData,
  printMedicalOrderDocument,
} from "@/features/recetas/utils/print-medical-order-document";

type Props = {
  data: MedicalOrderDocumentData;
  onPreview: () => void;
  compact?: boolean;
  onEdit?: () => void;
  onDelete?: () => void;
  acting?: boolean;
};

export function MedicalOrderActionButtons({
  data,
  onPreview,
  compact = false,
  onEdit,
  onDelete,
  acting = false,
}: Props) {
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
        onClick={() => printMedicalOrderDocument(data)}
        className="drflow-medical-order-action-btn inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-800 hover:bg-slate-50"
      >
        <Printer className="h-4 w-4" aria-hidden />
        Imprimir
      </button>
      {onEdit ? (
        <button
          type="button"
          onClick={onEdit}
          disabled={acting}
          className="drflow-medical-order-action-btn inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-800 hover:bg-slate-50 disabled:opacity-60"
        >
          <Pencil className="h-4 w-4" aria-hidden />
          Editar
        </button>
      ) : null}
      {onDelete ? (
        <button
          type="button"
          onClick={onDelete}
          disabled={acting}
          className="drflow-medical-order-action-btn inline-flex items-center justify-center gap-1.5 rounded-lg border border-red-300 bg-red-50 px-3 py-1.5 text-sm font-medium text-red-800 hover:bg-red-100 disabled:opacity-60"
        >
          <Trash2 className="h-4 w-4" aria-hidden />
          Eliminar
        </button>
      ) : null}
    </div>
  );
}
