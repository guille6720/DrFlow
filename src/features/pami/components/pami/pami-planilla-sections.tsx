"use client";

import { ClipboardCopy, FileCheck, Printer } from "lucide-react";
import { type KeyboardEvent, useId, useRef } from "react";

import { LiveStatusMessage } from "@/core/components/accessibility/live-status-message";
import { getPamiPlanillaFieldMaxLength } from "@/core/validations/pami-planilla";

import { PatientSearchCombobox } from "@/features/pacientes/components/pacientes/patient-search-combobox";
import { PamiPlanillasPatientFieldSkeleton } from "@/features/pami/components/pami/pami-planillas-skeleton";
import { usePamiMessages } from "@/features/pami/i18n";
import type { PamiPlanillaCategoryMeta } from "@/features/pami/types/pami-planilla-template";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type {
  PamiPlanillaPatient,
  PamiPlanillaProfessional,
} from "@/lib/hooks/use-pami-planillas";
import type { usePamiPlanillas } from "@/lib/hooks/use-pami-planillas";
import { getProfessionalDisplayName } from "@/lib/utils/professional";

const CATEGORY_BUTTON_FOCUS =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2";

type PlanillaState = ReturnType<typeof usePamiPlanillas>;

type Props = PlanillaState & {
  patients: PamiPlanillaPatient[];
  professionals: PamiPlanillaProfessional[];
  remotePatientSearch?: boolean;
  patientsLoading?: boolean;
};

export function PamiPlanillaCategorySection({
  categories,
  category,
  selectCategory,
}: {
  categories: PamiPlanillaCategoryMeta[];
} & Pick<PlanillaState, "category" | "selectCategory">) {
  const t = usePamiMessages().planillas;
  const groupId = useId();
  const legendId = `${groupId}-legend`;
  const radioRefs = useRef<Array<HTMLButtonElement | null>>([]);

  function focusRadio(index: number) {
    const button = radioRefs.current[index];
    button?.focus();
  }

  function handleRadioKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const lastIndex = categories.length - 1;
    let nextIndex: number | null = null;

    switch (event.key) {
      case "ArrowRight":
      case "ArrowDown":
        nextIndex = index >= lastIndex ? 0 : index + 1;
        break;
      case "ArrowLeft":
      case "ArrowUp":
        nextIndex = index <= 0 ? lastIndex : index - 1;
        break;
      case "Home":
        nextIndex = 0;
        break;
      case "End":
        nextIndex = lastIndex;
        break;
      default:
        return;
    }

    event.preventDefault();
    const nextCategory = categories[nextIndex];
    if (!nextCategory) return;
    selectCategory(nextCategory.id);
    focusRadio(nextIndex);
  }

  return (
    <Card title={t.category.cardTitle}>
      <div
        id={groupId}
        role="radiogroup"
        aria-labelledby={legendId}
        className="flex flex-wrap gap-2"
      >
        <span id={legendId} className="sr-only">
          {t.category.legendSrOnly}
        </span>
        {categories.map((c, index) => (
          <button
            key={c.id}
            ref={(node) => {
              radioRefs.current[index] = node;
            }}
            type="button"
            role="radio"
            aria-checked={category === c.id}
            aria-label={t.category.optionAriaLabel(c.label, c.description)}
            tabIndex={category === c.id ? 0 : -1}
            onClick={() => selectCategory(c.id)}
            onKeyDown={(event) => handleRadioKeyDown(event, index)}
            className={`rounded-xl border px-3 py-2 text-left text-sm transition ${CATEGORY_BUTTON_FOCUS} ${
              category === c.id
                ? "border-blue-600 bg-blue-50 text-blue-900"
                : "border-slate-300 bg-white hover:border-blue-300"
            }`}
          >
            <span className="font-medium">{c.label}</span>
            <span className="mt-0.5 block text-xs text-slate-600">{c.description}</span>
          </button>
        ))}
      </div>
    </Card>
  );
}

export function PamiPlanillaFieldsSection({
  patients,
  professionals,
  template,
  categoryTemplates,
  templateId: _templateId,
  setTemplateId,
  setValues,
  patientId,
  setPatientId,
  professionalId,
  setProfessionalId,
  values,
  remotePatientSearch,
  patientsLoading = false,
}: Props) {
  const t = usePamiMessages().planillas;
  return (
    <Card title={t.fields.cardTitle}>
      <div className="space-y-4">
        <Select
          label={t.fields.templateLabel}
          value={template?.id ?? ""}
          onChange={(e) => {
            setTemplateId(e.target.value);
            setValues({});
          }}
          options={categoryTemplates.map((t) => ({ value: t.id, label: t.title }))}
        />

        {patientsLoading ? (
          <PamiPlanillasPatientFieldSkeleton />
        ) : remotePatientSearch ? (
          <PatientSearchCombobox
            label={t.fields.patientLabel}
            patients={patients}
            defaultPatientId={patientId}
            onPatientChange={setPatientId}
            searchMode="remote"
            cobertura="pami"
            required
          />
        ) : (
          <Select
            label={t.fields.patientLabel}
            value={patientId}
            onChange={(e) => setPatientId(e.target.value)}
            placeholder={t.fields.patientPlaceholder}
            options={patients.map((p) => ({
              value: p.id,
              label: t.fields.patientOptionLabel(p.last_name, p.first_name, p.document_number),
            }))}
          />
        )}

        <Select
          label={t.fields.professionalLabel}
          value={professionalId}
          onChange={(e) => setProfessionalId(e.target.value)}
          placeholder={t.fields.professionalPlaceholder}
          options={professionals.map((p) => ({
            value: p.id,
            label: getProfessionalDisplayName(p),
          }))}
        />

        {template?.fields.map((field) =>
          field.multiline ? (
            <Textarea
              key={field.key}
              label={field.label}
              placeholder={field.placeholder}
              rows={3}
              maxLength={getPamiPlanillaFieldMaxLength(true)}
              value={values[field.key] ?? ""}
              onChange={(e) => setValues((v) => ({ ...v, [field.key]: e.target.value }))}
            />
          ) : (
            <Input
              key={field.key}
              label={field.label}
              placeholder={field.placeholder}
              maxLength={getPamiPlanillaFieldMaxLength(false)}
              value={values[field.key] ?? ""}
              onChange={(e) => setValues((v) => ({ ...v, [field.key]: e.target.value }))}
            />
          )
        )}
      </div>
    </Card>
  );
}

export function PamiPlanillaPreviewSection({
  rendered,
  loading,
  error,
  copyText,
  printText,
  handleSaveAsOrder,
}: Pick<
  PlanillaState,
  | "rendered"
  | "loading"
  | "error"
  | "copyText"
  | "printText"
  | "handleSaveAsOrder"
>) {
  const t = usePamiMessages().planillas;
  const previewId = useId();
  const feedbackId = useId();

  return (
    <Card title={t.preview.cardTitle}>
      {!rendered ? (
        <p id={previewId} className="text-sm text-slate-600">
          {t.preview.emptyHint}
        </p>
      ) : (
        <>
          <pre
            id={previewId}
            tabIndex={0}
            aria-label={t.preview.preAriaLabel}
            className="max-h-[420px] overflow-auto whitespace-pre-wrap rounded-xl bg-slate-50 p-4 text-sm text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2"
          >
            {rendered}
          </pre>
          <div
            className="mt-4 flex flex-wrap gap-2"
            role="group"
            aria-label={t.preview.actionsAriaLabel}
            aria-describedby={error ? feedbackId : undefined}
          >
            <Button type="button" size="sm" variant="outline" onClick={copyText}>
              <ClipboardCopy className="h-4 w-4" aria-hidden />
              {t.preview.copy}
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={printText}>
              <Printer className="h-4 w-4" aria-hidden />
              {t.preview.print}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="primary"
              loading={loading}
              pendingLabel="Guardando..."
              aria-label={loading ? t.preview.saveAriaLoading : t.preview.saveAriaIdle}
              onClick={handleSaveAsOrder}
              onKeyDown={(event) => {
                if (loading && (event.key === "Enter" || event.key === " ")) {
                  event.preventDefault();
                  event.stopPropagation();
                }
              }}
              onPointerDown={(event) => {
                if (loading) {
                  event.preventDefault();
                  event.stopPropagation();
                }
              }}
            >
              <FileCheck className="h-4 w-4" aria-hidden />
              {t.preview.save}
            </Button>
          </div>
          <div id={feedbackId} className="mt-2 space-y-2">
            {error ? <LiveStatusMessage tone="error">{error}</LiveStatusMessage> : null}
          </div>
        </>
      )}
    </Card>
  );
}
