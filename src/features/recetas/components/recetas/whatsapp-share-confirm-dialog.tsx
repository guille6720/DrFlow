"use client";

import { Button } from "@/components/ui/button";

type Props = {
  open: boolean;
  title: string;
  description: string;
  preview: string;
  onCancel: () => void;
  onConfirm: () => void;
};

export function WhatsAppShareConfirmDialog({
  open,
  title,
  description,
  preview,
  onCancel,
  onConfirm,
}: Props) {
  if (!open) return null;

  return (
    <div
      className="drflow-modal-root fixed inset-0 z-[100] flex items-center justify-center bg-black/45 p-4"
      onClick={onCancel}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="whatsapp-share-title"
        className="drflow-modal-panel w-full max-w-md rounded-xl border border-slate-200 bg-white p-5 text-slate-900 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="whatsapp-share-title" className="text-lg font-semibold text-slate-900">
          {title}
        </h2>
        <p className="drflow-modal-subtitle mt-2 text-sm text-slate-600">{description}</p>
        <pre className="mt-3 max-h-40 overflow-auto rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs whitespace-pre-wrap text-slate-800">
          {preview}
        </pre>
        <p className="mt-2 text-xs text-amber-800">
          Verificá paciente y medicación antes de enviar. Este mensaje no reemplaza la receta impresa.
        </p>
        <div className="mt-4 flex flex-wrap justify-end gap-2">
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancelar
          </Button>
          <Button type="button" onClick={onConfirm}>
            Enviar por WhatsApp
          </Button>
        </div>
      </div>
    </div>
  );
}
