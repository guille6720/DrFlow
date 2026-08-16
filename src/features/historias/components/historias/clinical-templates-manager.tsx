"use client";

import { ClipboardPaste, Plus, ScrollText } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { cn } from "@/shared/utils/cn";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  createClinicalTemplate,
  setClinicalTemplateActive,
  updateClinicalTemplate,
} from "@/lib/actions/clinical-templates";
import {
  CLINICAL_TEMPLATE_PASTE_EXAMPLES,
  CLINICAL_TEMPLATE_PASTE_FORMAT,
  parseClinicalTemplatePaste,
  resolveSpecialtyIdFromPaste,
} from "@/lib/utils/parse-clinical-template-paste";

export type ClinicalTemplateRow = {
  id: string;
  name: string;
  specialty_id: string | null;
  chief_complaint_template: string | null;
  diagnosis_template: string | null;
  evolution_template: string | null;
  indications_template: string | null;
  is_active: boolean;
};

type Props = {
  templates: ClinicalTemplateRow[];
  specialties: { id: string; name: string }[];
};

type EditorState = {
  id: string | null;
  name: string;
  specialty_id: string;
  chief_complaint_template: string;
  diagnosis_template: string;
  evolution_template: string;
  indications_template: string;
};

const emptyEditor = (): EditorState => ({
  id: null,
  name: "",
  specialty_id: "",
  chief_complaint_template: "",
  diagnosis_template: "",
  evolution_template: "",
  indications_template: "",
});

function toEditor(template: ClinicalTemplateRow): EditorState {
  return {
    id: template.id,
    name: template.name,
    specialty_id: template.specialty_id ?? "",
    chief_complaint_template: template.chief_complaint_template ?? "",
    diagnosis_template: template.diagnosis_template ?? "",
    evolution_template: template.evolution_template ?? "",
    indications_template: template.indications_template ?? "",
  };
}

export function ClinicalTemplatesManager({ templates, specialties }: Props) {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState<string | null>(templates[0]?.id ?? null);
  const [editor, setEditor] = useState<EditorState>(() =>
    templates[0] ? toEditor(templates[0]) : emptyEditor()
  );
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pasteText, setPasteText] = useState("");
  const [pasteHint, setPasteHint] = useState<string | null>(null);

  const sortedTemplates = useMemo(
    () => [...templates].sort((a, b) => a.name.localeCompare(b.name, "es")),
    [templates]
  );

  function selectTemplate(template: ClinicalTemplateRow) {
    setSelectedId(template.id);
    setEditor(toEditor(template));
    setMessage(null);
    setError(null);
  }

  function resetForNewPaste(pasteHintMessage?: string | null) {
    setSelectedId(null);
    setEditor(emptyEditor());
    setPasteText("");
    setPasteHint(pasteHintMessage ?? null);
    setMessage(null);
    setError(null);
  }

  function startNew() {
    resetForNewPaste();
  }

  function applyPastedTemplate(raw: string) {
    const trimmed = raw.trim();
    if (!trimmed) {
      setPasteHint("Pegá una plantilla con secciones como Nombre, Motivo, Evolución…");
      return;
    }

    const parsed = parseClinicalTemplatePaste(trimmed);
    const specialtyId = resolveSpecialtyIdFromPaste(parsed.specialty, specialties);

    setSelectedId(null);
    setEditor({
      id: null,
      name: parsed.name,
      specialty_id: specialtyId,
      chief_complaint_template: parsed.chief_complaint_template,
      diagnosis_template: parsed.diagnosis_template,
      evolution_template: parsed.evolution_template,
      indications_template: parsed.indications_template,
    });
    setMessage(null);
    setError(null);
    setPasteHint(
      parsed.specialty && !specialtyId
        ? `Campos completados. Especialidad "${parsed.specialty}" no encontrada; elegila manualmente.`
        : "Campos completados desde la plantilla pegada. Revisá y guardá."
    );
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    setError(null);

    const formData = new FormData(e.currentTarget);
    const result = editor.id
      ? await updateClinicalTemplate(formData)
      : await createClinicalTemplate(formData);

    setLoading(false);

    if ("error" in result && result.error) {
      setError(result.error);
      return;
    }

    const wasCreate = !editor.id;
    router.refresh();

    if (wasCreate) {
      resetForNewPaste("Plantilla creada. Podés pegar otra abajo.");
      return;
    }

    setMessage("Plantilla actualizada.");
    if ("data" in result && result.data?.id) {
      setSelectedId(result.data.id);
    }
  }

  async function toggleActive(template: ClinicalTemplateRow) {
    setLoading(true);
    setError(null);
    const fd = new FormData();
    fd.set("id", template.id);
    fd.set("is_active", template.is_active ? "0" : "1");
    const result = await setClinicalTemplateActive(fd);
    setLoading(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setMessage(template.is_active ? "Plantilla desactivada." : "Plantilla activada.");
    router.refresh();
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[18rem_minmax(0,1fr)]">
      <aside className="drflow-card-light drflow-light-sidebar-panel rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
        <div className="flex items-center justify-between gap-2 px-1 pb-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-800">Plantillas</p>
          <button
            type="button"
            onClick={startNew}
            className="inline-flex items-center gap-1 rounded-lg border border-teal-200 bg-teal-50 px-2 py-1 text-xs font-semibold text-teal-800 hover:bg-teal-100"
          >
            <Plus className="h-3.5 w-3.5" />
            Nueva
          </button>
        </div>

        {sortedTemplates.length === 0 ? (
          <p className="px-2 pb-3 text-sm text-slate-800">
            Todavía no hay plantillas guardadas. Podés pegar una predefinida abajo o crear la
            primera desde el formulario.
          </p>
        ) : (
          <ul className="mb-3 space-y-1">
            {sortedTemplates.map((template) => {
              const active = selectedId === template.id;
              return (
                <li key={template.id}>
                  <button
                    type="button"
                    onClick={() => selectTemplate(template)}
                    className={cn(
                      "flex w-full items-start gap-2 rounded-xl px-3 py-2.5 text-left transition",
                      active
                        ? "bg-gradient-to-r from-teal-500 to-cyan-500 text-slate-900 shadow-md"
                        : "text-slate-900 hover:bg-slate-50"
                    )}
                  >
                    <ScrollText
                      className={cn(
                        "mt-0.5 h-4 w-4 shrink-0",
                        active ? "text-slate-900" : "text-teal-700"
                      )}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold">{template.name}</span>
                      {!template.is_active ? (
                        <span
                          className={cn(
                            "mt-0.5 block text-xs font-medium",
                            active ? "text-slate-800" : "text-amber-700"
                          )}
                        >
                          Inactiva
                        </span>
                      ) : null}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        <div className="space-y-2 border-t border-slate-200 pt-3">
          <div className="flex items-center gap-2 px-1">
            <ClipboardPaste className="h-4 w-4 shrink-0 text-teal-700" aria-hidden />
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-800">
              Pegar plantilla
            </p>
          </div>
          <p className="px-1 text-xs leading-relaxed text-slate-600">
            Usá secciones como{" "}
            <span className="font-medium text-slate-800">Nombre</span>,{" "}
            <span className="font-medium text-slate-800">Motivo de consulta</span>,{" "}
            <span className="font-medium text-slate-800">Evolución</span>, etc. También podés pegar
            JSON.
          </p>
          <Textarea
            rows={8}
            value={pasteText}
            onChange={(e) => {
              setPasteText(e.target.value);
              if (pasteHint) setPasteHint(null);
            }}
            onPaste={(e) => {
              const pasted = e.clipboardData.getData("text");
              if (!pasted.trim()) return;
              window.setTimeout(() => {
                setPasteText(pasted);
                applyPastedTemplate(pasted);
              }, 0);
            }}
            placeholder={CLINICAL_TEMPLATE_PASTE_FORMAT}
            className="text-xs leading-relaxed"
          />
          <div className="flex flex-wrap gap-1.5 px-1">
            {CLINICAL_TEMPLATE_PASTE_EXAMPLES.map((example) => (
              <button
                key={example.label}
                type="button"
                onClick={() => {
                  setPasteText(example.text);
                  applyPastedTemplate(example.text);
                }}
                className="rounded-lg border border-teal-200 bg-teal-50 px-2 py-1 text-xs font-medium text-teal-900 hover:bg-teal-100"
              >
                {example.label}
              </button>
            ))}
          </div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="w-full"
            onClick={() => applyPastedTemplate(pasteText)}
          >
            Aplicar al formulario
          </Button>
          {pasteHint ? (
            <p className="rounded-lg border border-sky-200 bg-sky-50 px-2 py-1.5 text-xs text-sky-900">
              {pasteHint}
            </p>
          ) : null}
        </div>
      </aside>

      <Card
        title={editor.id ? "Editar plantilla" : "Nueva plantilla"}
        description="Estos textos se pueden aplicar al escribir una evolución clínica."
      >
        <form onSubmit={handleSubmit} className="grid gap-4">
          {editor.id ? <input type="hidden" name="id" value={editor.id} /> : null}

          {message ? (
            <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
              {message}
            </p>
          ) : null}
          {error ? (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
              {error}
            </p>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              name="name"
              label="Nombre"
              required
              value={editor.name}
              onChange={(e) => setEditor((prev) => ({ ...prev, name: e.target.value }))}
              placeholder="Ej. Control HTA, Primera consulta…"
            />
            <Select
              name="specialty_id"
              label="Especialidad (opcional)"
              value={editor.specialty_id}
              onChange={(e) => setEditor((prev) => ({ ...prev, specialty_id: e.target.value }))}
              options={specialties.map((s) => ({ value: s.id, label: s.name }))}
              placeholder="Todas las especialidades"
            />
          </div>

          <Textarea
            name="evolution_template"
            label="Texto de evolución"
            rows={6}
            value={editor.evolution_template}
            onChange={(e) => setEditor((prev) => ({ ...prev, evolution_template: e.target.value }))}
            placeholder="Paciente refiere… Examen físico… Plan…"
          />
          <Textarea
            name="chief_complaint_template"
            label="Motivo de consulta (opcional)"
            rows={3}
            value={editor.chief_complaint_template}
            onChange={(e) =>
              setEditor((prev) => ({ ...prev, chief_complaint_template: e.target.value }))
            }
          />
          <Textarea
            name="diagnosis_template"
            label="Diagnóstico (opcional)"
            rows={3}
            value={editor.diagnosis_template}
            onChange={(e) => setEditor((prev) => ({ ...prev, diagnosis_template: e.target.value }))}
          />
          <Textarea
            name="indications_template"
            label="Indicaciones (opcional)"
            rows={3}
            value={editor.indications_template}
            onChange={(e) =>
              setEditor((prev) => ({ ...prev, indications_template: e.target.value }))
            }
          />

          <div className="flex flex-wrap gap-2">
            <Button type="submit" loading={loading}>
              {editor.id ? "Guardar cambios" : "Crear plantilla"}
            </Button>
            {editor.id ? (
              <Button
                type="button"
                variant="outline"
                loading={loading}
                onClick={() => {
                  const current = templates.find((t) => t.id === editor.id);
                  if (current) void toggleActive(current);
                }}
              >
                {templates.find((t) => t.id === editor.id)?.is_active
                  ? "Desactivar"
                  : "Reactivar"}
              </Button>
            ) : null}
          </div>
        </form>
      </Card>
    </div>
  );
}
