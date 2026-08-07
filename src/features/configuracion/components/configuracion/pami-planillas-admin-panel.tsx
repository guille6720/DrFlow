"use client";

import { ChevronDown, ChevronRight, ClipboardList, Loader2, Save } from "lucide-react";
import { useId, useMemo, useState, useTransition } from "react";

import { LiveStatusMessage } from "@/core/components/accessibility/live-status-message";

import { usePamiMessages } from "@/features/pami/i18n";
import type { PamiPlanillaFieldDef } from "@/features/pami/types/pami-planilla-template";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  type PamiPlanillaAdminCatalog,
  type PamiPlanillaAdminTemplate,
  publishPamiPlanillaTemplate,
  setPamiPlanillaClinicActive,
} from "@/lib/actions/pami-planilla-admin";

type Props = {
  initialCatalog: PamiPlanillaAdminCatalog;
};

type EditorState = {
  body: string;
  fields: PamiPlanillaFieldDef[];
  changeNotes: string;
};

function buildEditorState(template: PamiPlanillaAdminTemplate): EditorState {
  return {
    body: template.template,
    fields: template.fields.map((f) => ({
      key: f.key,
      label: f.label,
      multiline: f.multiline,
      placeholder: f.placeholder,
    })),
    changeNotes: "",
  };
}

function TemplateEditorRow({
  template,
  categoryLabel,
  onUpdated,
}: {
  template: PamiPlanillaAdminTemplate;
  categoryLabel: string;
  onUpdated: (next: PamiPlanillaAdminTemplate) => void;
}) {
  const m = usePamiMessages().admin;
  const panelId = useId();
  const feedbackId = useId();
  const [open, setOpen] = useState(false);
  const [editor, setEditor] = useState<EditorState>(() => buildEditorState(template));
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const effectiveActive = template.is_active_global && template.is_active_clinic;

  function toggleClinicActive(checked: boolean) {
    setErr(null);
    setMsg(null);
    startTransition(async () => {
      const result = await setPamiPlanillaClinicActive(template.id, checked);
      if (result.error) {
        setErr(result.error);
        return;
      }
      onUpdated({ ...template, is_active_clinic: checked });
      setMsg(checked ? m.activatedClinic : m.deactivatedClinic);
    });
  }

  function saveVersion() {
    setErr(null);
    setMsg(null);
    startTransition(async () => {
      const result = await publishPamiPlanillaTemplate({
        templateSlug: template.id,
        bodyTemplate: editor.body,
        fields: editor.fields,
        changeNotes: editor.changeNotes,
      });
      if (result.error) {
        setErr(result.error);
        return;
      }
      const nextVersion = result.versionNumber ?? template.version_number + 1;
      onUpdated({
        ...template,
        template: editor.body,
        fields: editor.fields,
        version_number: nextVersion,
      });
      setEditor((prev) => ({ ...prev, changeNotes: "" }));
      setMsg(m.versionPublished(nextVersion));
    });
  }

  function updateField(index: number, patch: Partial<PamiPlanillaFieldDef>) {
    setEditor((prev) => ({
      ...prev,
      fields: prev.fields.map((f, i) => (i === index ? { ...f, ...patch } : f)),
    }));
  }

  function addField() {
    setEditor((prev) => ({
      ...prev,
      fields: [
        ...prev.fields,
        { key: `campo_${prev.fields.length + 1}`, label: m.defaultFieldLabel, multiline: false },
      ],
    }));
  }

  function removeField(index: number) {
    setEditor((prev) => ({
      ...prev,
      fields: prev.fields.filter((_, i) => i !== index),
    }));
  }

  return (
    <li className="rounded-xl border border-slate-300 bg-white">
      <div className="flex flex-wrap items-center justify-between gap-3 p-4">
        <button
          type="button"
          className="flex min-w-0 flex-1 items-start gap-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2 rounded-lg"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? (
            <ChevronDown className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" aria-hidden />
          ) : (
            <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" aria-hidden />
          )}
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-medium text-slate-900">{template.title}</p>
              <Badge variant="info">v{template.version_number}</Badge>
              {!effectiveActive ? <Badge variant="warning">{m.inactiveBadge}</Badge> : null}
            </div>
            <p className="mt-0.5 text-xs text-slate-600">
              {categoryLabel} · slug <code className="rounded bg-slate-100 px-1">{template.id}</code>
            </p>
          </div>
        </button>

        <label className="flex shrink-0 items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-slate-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
            checked={template.is_active_clinic}
            disabled={pending || !template.is_active_global}
            aria-label={m.activateTemplateAria(template.title)}
            onChange={(e) => toggleClinicActive(e.target.checked)}
          />
          {m.activeClinicLabel}
        </label>
      </div>

      {open ? (
        <div id={panelId} className="space-y-4 border-t border-slate-100 p-4">
          {!template.is_active_global ? (
            <p className="text-sm text-amber-800">{m.globallyDisabled}</p>
          ) : null}

          <Textarea
            label={m.bodyLabel}
            rows={12}
            value={editor.body}
            onChange={(e) => setEditor((prev) => ({ ...prev, body: e.target.value }))}
            className="font-mono text-sm"
          />
          <p className="text-xs text-slate-600">{m.bodyHint}</p>

          <div>
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="text-sm font-medium text-slate-800">{m.dynamicFieldsTitle}</p>
              <Button type="button" size="sm" variant="outline" onClick={addField}>
                {m.addField}
              </Button>
            </div>
            <div className="space-y-3">
              {editor.fields.map((field, index) => (
                <div
                  key={`${field.key}-${index}`}
                  className="grid gap-2 rounded-lg border border-slate-200 bg-slate-50/80 p-3 sm:grid-cols-2"
                >
                  <Input
                    label={m.keyLabel}
                    value={field.key}
                    onChange={(e) => updateField(index, { key: e.target.value })}
                  />
                  <Input
                    label={m.labelLabel}
                    value={field.label}
                    onChange={(e) => updateField(index, { label: e.target.value })}
                  />
                  <Input
                    label={m.placeholderLabel}
                    value={field.placeholder ?? ""}
                    onChange={(e) => updateField(index, { placeholder: e.target.value })}
                  />
                  <label className="flex items-center gap-2 self-end pb-2 text-sm">
                    <input
                      type="checkbox"
                      className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
                      checked={field.multiline ?? false}
                      aria-label={m.multilineAria(field.label)}
                      onChange={(e) => updateField(index, { multiline: e.target.checked })}
                    />
                    {m.multilineLabel}
                  </label>
                  <div className="sm:col-span-2">
                    <Button type="button" size="sm" variant="ghost" onClick={() => removeField(index)}>
                      {m.removeField}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <Input
            label={m.changeNotesLabel}
            placeholder={m.changeNotesPlaceholder}
            value={editor.changeNotes}
            onChange={(e) => setEditor((prev) => ({ ...prev, changeNotes: e.target.value }))}
          />

          <div id={feedbackId} className="space-y-2">
            {msg ? <LiveStatusMessage tone="success">{msg}</LiveStatusMessage> : null}
            {err ? <LiveStatusMessage tone="error">{err}</LiveStatusMessage> : null}
          </div>

          <Button
            type="button"
            onClick={saveVersion}
            loading={pending}
            aria-busy={pending}
            aria-describedby={msg || err ? feedbackId : undefined}
            aria-label={pending ? m.publishAriaLoading : m.publishAriaIdle}
          >
            {pending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Save className="h-4 w-4" aria-hidden />}
            {m.publishButton}
          </Button>
        </div>
      ) : null}
    </li>
  );
}

export function PamiPlanillasAdminPanel({ initialCatalog }: Props) {
  const m = usePamiMessages().admin;
  const [catalog, setCatalog] = useState(initialCatalog);

  const categoryLabels = useMemo(
    () => new Map(catalog.categories.map((c) => [c.id, c.label])),
    [catalog.categories]
  );

  function updateTemplate(next: PamiPlanillaAdminTemplate) {
    setCatalog((prev) => ({
      ...prev,
      templates: prev.templates.map((t) => (t.id === next.id ? next : t)),
    }));
  }

  return (
    <Card title={m.cardTitle}>
      <div className="mb-4 flex items-start gap-2 rounded-lg border border-blue-100 bg-blue-50/80 px-3 py-2 text-sm text-blue-900">
        <ClipboardList className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
        <p>{m.infoBanner}</p>
      </div>

      {catalog.templates.length === 0 ? (
        <p className="text-sm text-slate-600" role="status">
          {m.emptyCatalog}
        </p>
      ) : (
        <ul className="space-y-3" aria-label={m.templatesListAria}>
          {catalog.templates.map((template) => (
            <TemplateEditorRow
              key={template.id}
              template={template}
              categoryLabel={categoryLabels.get(template.category) ?? template.category}
              onUpdated={updateTemplate}
            />
          ))}
        </ul>
      )}
    </Card>
  );
}
