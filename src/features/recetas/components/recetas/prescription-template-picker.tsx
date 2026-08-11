"use client";

import { BookTemplate, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";

import { listPrescriptionTemplates } from "@/features/recetas/actions/prescription-templates";
import type { PrescriptionTemplateRow } from "@/features/recetas/repositories/prescription-templates.repository";

import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";

type Props = {
  professionalId?: string;
  onApply: (template: PrescriptionTemplateRow) => void;
};

export function PrescriptionTemplatePicker({ professionalId, onApply }: Props) {
  const [templates, setTemplates] = useState<PrescriptionTemplateRow[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void listPrescriptionTemplates(professionalId).then((result) => {
      if (cancelled) return;
      setLoading(false);
      if (result.error) {
        setError(result.error);
        return;
      }
      setTemplates(result.data ?? []);
    });
    return () => {
      cancelled = true;
    };
  }, [professionalId]);

  const selected = templates.find((t) => t.id === selectedId) ?? null;

  if (loading) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        Cargando plantillas…
      </div>
    );
  }

  if (templates.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
        No hay plantillas de receta. Creá una en Médicos → Plantillas recetas.
      </p>
    );
  }

  return (
    <div className="rounded-xl border border-teal-200 bg-teal-50/50 p-3">
      <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-teal-900">
        <BookTemplate className="h-3.5 w-3.5" aria-hidden />
        Aplicar plantilla
      </p>
      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-[200px] flex-1">
          <Select
            label="Plantilla"
            value={selectedId}
            onChange={(e) => setSelectedId(e.target.value)}
            options={templates.map((t) => ({
              value: t.id,
              label: `${t.name} (${t.medications.length} med.)`,
            }))}
            placeholder="Seleccionar plantilla"
          />
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={!selected}
          onClick={() => selected && onApply(selected)}
        >
          Aplicar
        </Button>
      </div>
      {error ? <p className="mt-2 text-xs text-red-600">{error}</p> : null}
      <p className="mt-2 text-xs text-teal-800">
        Prefill de medicamentos e indicaciones — revisá cobertura y diagnóstico antes de emitir.
      </p>
    </div>
  );
}
