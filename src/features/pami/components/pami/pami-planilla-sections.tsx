"use client";

import { ClipboardCopy, FileCheck, Printer } from "lucide-react";

import { PatientSearchCombobox } from "@/features/pacientes/components/pacientes/patient-search-combobox";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { PAMI_PLANILLA_CATEGORIES } from "@/lib/constants/pami-planillas";
import type {
  PamiPlanillaPatient,
  PamiPlanillaProfessional,
} from "@/lib/hooks/use-pami-planillas";
import type { usePamiPlanillas } from "@/lib/hooks/use-pami-planillas";
import { getProfessionalDisplayName } from "@/lib/utils/professional";

type PlanillaState = ReturnType<typeof usePamiPlanillas>;

type Props = PlanillaState & {
  patients: PamiPlanillaPatient[];
  professionals: PamiPlanillaProfessional[];
  remotePatientSearch?: boolean;
};

export function PamiPlanillaCategorySection({
  category,
  selectCategory,
}: Pick<PlanillaState, "category" | "selectCategory">) {
  return (
    <Card title="Tipo de solicitud PAMI">
      <div className="flex flex-wrap gap-2">
        {PAMI_PLANILLA_CATEGORIES.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => selectCategory(c.id)}
            className={`rounded-xl border px-3 py-2 text-left text-sm transition ${
              category === c.id
                ? "border-blue-600 bg-blue-50 text-blue-900"
                : "border-slate-200 bg-white hover:border-blue-200"
            }`}
          >
            <span className="font-medium">{c.label}</span>
            <span className="mt-0.5 block text-xs text-slate-500">{c.description}</span>
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
}: Props) {
  return (
      <Card title="Completar planilla">
        <div className="space-y-4">
          <Select
            label="Plantilla"
            value={template?.id ?? ""}
            onChange={(e) => {
              setTemplateId(e.target.value);
              setValues({});
            }}
            options={categoryTemplates.map((t) => ({ value: t.id, label: t.title }))}
          />

          {remotePatientSearch ? (
            <PatientSearchCombobox
              label="Paciente PAMI"
              patients={patients}
              defaultPatientId={patientId}
              onPatientChange={setPatientId}
              searchMode="remote"
              cobertura="pami"
              required
            />
          ) : (
            <Select
              label="Paciente PAMI"
              value={patientId}
              onChange={(e) => setPatientId(e.target.value)}
              placeholder="Seleccionar paciente"
              options={patients.map((p) => ({
                value: p.id,
                label: `${p.last_name}, ${p.first_name} — DNI ${p.document_number}`,
              }))}
            />
          )}

          <Select
            label="Profesional"
            value={professionalId}
            onChange={(e) => setProfessionalId(e.target.value)}
            placeholder="Seleccionar"
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
                value={values[field.key] ?? ""}
                onChange={(e) => setValues((v) => ({ ...v, [field.key]: e.target.value }))}
              />
            ) : (
              <Input
                key={field.key}
                label={field.label}
                placeholder={field.placeholder}
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
  msg,
  error,
  copyText,
  printText,
  saveAsOrder,
}: Pick<
  PlanillaState,
  "rendered" | "loading" | "msg" | "error" | "copyText" | "printText" | "saveAsOrder"
>) {
  return (
    <Card title="Vista previa">
      {!rendered ? (
        <p className="text-sm text-slate-500">
          Elegí paciente, profesional y completá los campos para generar la planilla.
        </p>
      ) : (
        <>
          <pre className="max-h-[420px] overflow-auto whitespace-pre-wrap rounded-xl bg-slate-50 p-4 text-sm text-slate-800">
            {rendered}
          </pre>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button type="button" size="sm" variant="outline" onClick={copyText}>
              <ClipboardCopy className="h-4 w-4" />
              Copiar
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={printText}>
              <Printer className="h-4 w-4" />
              Imprimir / PDF
            </Button>
            <Button type="button" size="sm" loading={loading} onClick={saveAsOrder}>
              <FileCheck className="h-4 w-4" />
              Guardar en historial
            </Button>
          </div>
          {msg && <p className="mt-2 text-sm text-emerald-700">{msg}</p>}
          {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
        </>
      )}
    </Card>
  );
}
