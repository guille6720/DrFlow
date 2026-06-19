"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import {
  PAMI_PLANILLA_CATEGORIES,
  PAMI_PLANILLA_TEMPLATES,
  renderPamiPlanilla,
  type PamiPlanillaCategory,
  type PamiPlanillaTemplate,
} from "@/lib/constants/pami-planillas";
import { createMedicalOrder } from "@/lib/actions/medical-orders";
import { getProfessionalDisplayName } from "@/lib/utils/professional";
import { ClipboardCopy, FileCheck, Printer } from "lucide-react";

interface Patient {
  id: string;
  first_name: string;
  last_name: string;
  document_number: string;
  insurance_number: string | null;
  phone: string | null;
  address: string | null;
}

interface Professional {
  id: string;
  license_number?: string | null;
  display_name?: string | null;
  profiles?: { full_name: string } | null;
}

interface Props {
  patients: Patient[];
  professionals: Professional[];
  defaultProfessionalId?: string;
}

export function PamiPlanillasView({
  patients,
  professionals,
  defaultProfessionalId,
}: Props) {
  const router = useRouter();
  const [category, setCategory] = useState<PamiPlanillaCategory>("internacion_domiciliaria");
  const [templateId, setTemplateId] = useState(PAMI_PLANILLA_TEMPLATES[0]!.id);
  const [patientId, setPatientId] = useState("");
  const [professionalId, setProfessionalId] = useState(defaultProfessionalId ?? "");
  const [values, setValues] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const categoryTemplates = useMemo(
    () => PAMI_PLANILLA_TEMPLATES.filter((t) => t.category === category),
    [category]
  );

  const template: PamiPlanillaTemplate | undefined =
    categoryTemplates.find((t) => t.id === templateId) ?? categoryTemplates[0];

  const patient = patients.find((p) => p.id === patientId);
  const professional = professionals.find((p) => p.id === professionalId);

  const rendered = useMemo(() => {
    if (!template || !patient || !professional) return "";
    return renderPamiPlanilla(template, values, {
      patientName: `${patient.last_name}, ${patient.first_name}`,
      patientDni: patient.document_number,
      patientPami: patient.insurance_number ?? "",
      professionalName: getProfessionalDisplayName(professional),
      licenseNumber: professional.license_number ?? "",
      patientAddress: patient.address ?? undefined,
    });
  }, [template, values, patient, professional]);

  function selectCategory(id: PamiPlanillaCategory) {
    setCategory(id);
    const first = PAMI_PLANILLA_TEMPLATES.find((t) => t.category === id);
    if (first) {
      setTemplateId(first.id);
      setValues({});
    }
  }

  async function copyText() {
    if (!rendered) return;
    await navigator.clipboard.writeText(rendered);
    setMsg("Copiado al portapapeles");
    setTimeout(() => setMsg(null), 2000);
  }

  function printText() {
    if (!rendered) return;
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(`<pre style="font-family:system-ui;padding:24px;white-space:pre-wrap">${rendered.replace(/</g, "&lt;")}</pre>`);
    w.document.close();
    w.print();
  }

  async function saveAsOrder() {
    if (!patient || !professional || !rendered) {
      setError("Seleccioná paciente, profesional y completá la planilla.");
      return;
    }
    setLoading(true);
    setError(null);
    const fd = new FormData();
    fd.set("patient_id", patient.id);
    fd.set("professional_id", professional.id);
    fd.set("order_text", rendered);
    fd.set("order_type", "pami_form");
    fd.set("notes", template?.title ?? "Planilla PAMI");
    const result = await createMedicalOrder(fd);
    setLoading(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setMsg("Planilla guardada como orden médica");
    router.refresh();
  }

  return (
    <div className="space-y-6">
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

      <div className="grid gap-6 lg:grid-cols-2">
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
                  onChange={(e) =>
                    setValues((v) => ({ ...v, [field.key]: e.target.value }))
                  }
                />
              ) : (
                <Input
                  key={field.key}
                  label={field.label}
                  placeholder={field.placeholder}
                  value={values[field.key] ?? ""}
                  onChange={(e) =>
                    setValues((v) => ({ ...v, [field.key]: e.target.value }))
                  }
                />
              )
            )}
          </div>
        </Card>

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
      </div>
    </div>
  );
}
