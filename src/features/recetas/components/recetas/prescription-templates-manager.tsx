"use client";

import { Pill, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { cn } from "@/shared/utils/cn";

import {
  createPrescriptionTemplate,
  removePrescriptionTemplate,
  updatePrescriptionTemplateAction,
} from "@/features/recetas/actions/prescription-templates";
import { PrescriptionDiagnosisFields } from "@/features/recetas/components/recetas/prescription-diagnosis-fields";
import { emptyPrescriptionMedication } from "@/features/recetas/components/recetas/prescription-form-utils";
import { PrescriptionMedicationsSection } from "@/features/recetas/components/recetas/prescription-medications-section";
import { COVERAGE_KINDS } from "@/features/recetas/engine/types";
import type { PrescriptionTemplateRow } from "@/features/recetas/repositories/prescription-templates.repository";
import {
  getEffectiveCoverageRule,
  isCoverageKind,
} from "@/features/recetas/utils/coverage-rules-admin";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { getProfessionalDisplayName } from "@/lib/utils/professional";
import type { PathologySearchResult } from "@/types/pharmacology";
import type { PrescriptionMedication } from "@/types/prescription";

type Professional = {
  id: string;
  display_name?: string | null;
  license_number?: string | null;
  profiles?: { full_name: string } | null;
};

type Props = {
  templates: PrescriptionTemplateRow[];
  professionals: Professional[];
  defaultProfessionalId?: string;
};

type EditorState = {
  id: string | null;
  name: string;
  professional_id: string;
  coverage_kind: string;
  medications: PrescriptionMedication[];
  notes: string;
  diagnosis_cie10: string;
  diagnosis_text: string;
};

const emptyEditor = (defaultProfessionalId?: string): EditorState => ({
  id: null,
  name: "",
  professional_id: defaultProfessionalId ?? "",
  coverage_kind: "",
  medications: [emptyPrescriptionMedication()],
  notes: "",
  diagnosis_cie10: "",
  diagnosis_text: "",
});

function toEditor(template: PrescriptionTemplateRow): EditorState {
  return {
    id: template.id,
    name: template.name,
    professional_id: template.professional_id ?? "",
    coverage_kind: template.coverage_kind ?? "",
    medications:
      template.medications.length > 0 ? template.medications : [emptyPrescriptionMedication()],
    notes: template.notes ?? "",
    diagnosis_cie10: template.diagnosis_cie10 ?? "",
    diagnosis_text: template.diagnosis_text ?? "",
  };
}

export function PrescriptionTemplatesManager({
  templates,
  professionals,
  defaultProfessionalId,
}: Props) {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState<string | null>(templates[0]?.id ?? null);
  const [editor, setEditor] = useState<EditorState>(() =>
    templates[0] ? toEditor(templates[0]) : emptyEditor(defaultProfessionalId)
  );
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const sortedTemplates = useMemo(
    () => [...templates].sort((a, b) => a.name.localeCompare(b.name, "es")),
    [templates]
  );

  const templateMedicationSearch = useMemo(() => {
    const kind = editor.coverage_kind;
    if (!isCoverageKind(kind)) return "pharmacology" as const;
    return getEffectiveCoverageRule(kind, null).medicationSearch;
  }, [editor.coverage_kind]);

  function handlePathologySelect(pathology: PathologySearchResult) {
    setEditor((prev) => ({
      ...prev,
      diagnosis_cie10: prev.diagnosis_cie10.trim() ? prev.diagnosis_cie10 : pathology.cie10_code,
      diagnosis_text: prev.diagnosis_text.trim() ? prev.diagnosis_text : pathology.name,
    }));
  }

  function selectTemplate(template: PrescriptionTemplateRow) {
    setSelectedId(template.id);
    setEditor(toEditor(template));
    setMessage(null);
    setError(null);
  }

  function startNew() {
    setSelectedId(null);
    setEditor(emptyEditor(defaultProfessionalId));
    setMessage(null);
    setError(null);
  }

  function updateMed(
    index: number,
    field: keyof PrescriptionMedication,
    value: string | number | boolean
  ) {
    setEditor((prev) => ({
      ...prev,
      medications: prev.medications.map((m, i) => (i === index ? { ...m, [field]: value } : m)),
    }));
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    setError(null);

    const formData = new FormData();
    if (editor.id) formData.set("id", editor.id);
    formData.set("name", editor.name);
    if (editor.professional_id) formData.set("professional_id", editor.professional_id);
    if (editor.coverage_kind) formData.set("coverage_kind", editor.coverage_kind);
    formData.set("medications_json", JSON.stringify(editor.medications));
    formData.set("notes", editor.notes);
    formData.set("diagnosis_cie10", editor.diagnosis_cie10);
    formData.set("diagnosis_text", editor.diagnosis_text);

    const result = editor.id
      ? await updatePrescriptionTemplateAction(formData)
      : await createPrescriptionTemplate(formData);

    setLoading(false);
    if (result.error) {
      setError(result.error);
      return;
    }

    setMessage(editor.id ? "Plantilla actualizada." : "Plantilla creada.");
    router.refresh();
  }

  async function handleDelete() {
    if (!editor.id) return;
    if (!window.confirm(`¿Eliminar la plantilla "${editor.name}"?`)) return;

    setLoading(true);
    setError(null);
    const result = await removePrescriptionTemplate(editor.id);
    setLoading(false);

    if (result.error) {
      setError(result.error);
      return;
    }

    setMessage("Plantilla eliminada.");
    startNew();
    router.refresh();
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(220px,280px)_1fr]">
      <Card title="Plantillas guardadas">
        <div className="space-y-2">
          <Button type="button" size="sm" variant="outline" className="w-full" onClick={startNew}>
            <Plus className="h-4 w-4" />
            Nueva plantilla
          </Button>
          {sortedTemplates.length === 0 ? (
            <p className="text-sm text-slate-500">Todavía no hay plantillas de receta.</p>
          ) : (
            <ul className="space-y-1">
              {sortedTemplates.map((template) => (
                <li key={template.id}>
                  <button
                    type="button"
                    onClick={() => selectTemplate(template)}
                    className={cn(
                      "w-full rounded-lg px-3 py-2 text-left text-sm transition",
                      selectedId === template.id
                        ? "bg-teal-100 font-semibold text-teal-900"
                        : "text-slate-700 hover:bg-slate-100"
                    )}
                  >
                    <span className="flex items-center gap-2">
                      <Pill className="h-3.5 w-3.5 shrink-0" aria-hidden />
                      {template.name}
                    </span>
                    <span className="mt-0.5 block text-xs font-normal text-slate-500">
                      {template.medications.length} medicamento
                      {template.medications.length === 1 ? "" : "s"}
                      {template.coverage_kind ? ` · ${template.coverage_kind}` : ""}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Card>

      <Card title={editor.id ? "Editar plantilla" : "Nueva plantilla de receta"}>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <Input
            label="Nombre"
            required
            value={editor.name}
            onChange={(e) => setEditor((prev) => ({ ...prev, name: e.target.value }))}
            placeholder="Ej. HTA ambulatoria, Diabetes tipo 2"
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <Select
              label="Profesional (opcional)"
              value={editor.professional_id}
              onChange={(e) => setEditor((prev) => ({ ...prev, professional_id: e.target.value }))}
              options={[
                { value: "", label: "Toda la clínica" },
                ...professionals.map((p) => ({
                  value: p.id,
                  label: getProfessionalDisplayName(p),
                })),
              ]}
            />
            <Select
              label="Cobertura sugerida (opcional)"
              value={editor.coverage_kind}
              onChange={(e) => setEditor((prev) => ({ ...prev, coverage_kind: e.target.value }))}
              options={[
                { value: "", label: "Cualquiera" },
                ...COVERAGE_KINDS.map((kind) => ({ value: kind, label: kind })),
              ]}
            />
          </div>

          <PrescriptionDiagnosisFields
            diagnosisText={editor.diagnosis_text}
            cie10={editor.diagnosis_cie10}
            onDiagnosisTextChange={(value) =>
              setEditor((prev) => ({ ...prev, diagnosis_text: value }))
            }
            onCie10Change={(value) => setEditor((prev) => ({ ...prev, diagnosis_cie10: value }))}
          />

          <PrescriptionMedicationsSection
            medications={editor.medications}
            setMedications={(value) =>
              setEditor((prev) => ({
                ...prev,
                medications: typeof value === "function" ? value(prev.medications) : value,
              }))
            }
            updateMed={updateMed}
            medicationSearch={templateMedicationSearch}
            onPathologySelect={handlePathologySelect}
          />

          <Textarea
            label="Observaciones (opcional)"
            rows={2}
            value={editor.notes}
            onChange={(e) => setEditor((prev) => ({ ...prev, notes: e.target.value }))}
          />

          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          {message ? <p className="text-sm text-teal-700">{message}</p> : null}

          <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-4">
            <Button type="submit" loading={loading}>
              {editor.id ? "Guardar cambios" : "Crear plantilla"}
            </Button>
            {editor.id ? (
              <Button type="button" variant="outline" loading={loading} onClick={handleDelete}>
                <Trash2 className="h-4 w-4" />
                Eliminar
              </Button>
            ) : null}
          </div>

          <p className="text-xs text-slate-500">
            Las plantillas solo prefieren medicamentos e indicaciones. Siempre requieren revisión
            médica antes de emitir.
          </p>
        </form>
      </Card>
    </div>
  );
}
