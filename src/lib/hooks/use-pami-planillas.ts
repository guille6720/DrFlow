"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  PAMI_PLANILLA_TEMPLATES,
  renderPamiPlanilla,
  type PamiPlanillaCategory,
  type PamiPlanillaTemplate,
} from "@/lib/constants/pami-planillas";
import { createMedicalOrder } from "@/lib/actions/medical-orders";
import { getProfessionalDisplayName } from "@/lib/utils/professional";

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

export function usePamiPlanillas(
  patients: Patient[],
  professionals: Professional[],
  defaultProfessionalId?: string
) {
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
    w.document.write(
      `<pre style="font-family:system-ui;padding:24px;white-space:pre-wrap">${rendered.replace(/</g, "&lt;")}</pre>`
    );
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

  return {
    category,
    selectCategory,
    template,
    categoryTemplates,
    templateId,
    setTemplateId,
    setValues,
    patientId,
    setPatientId,
    professionalId,
    setProfessionalId,
    values,
    rendered,
    loading,
    msg,
    error,
    copyText,
    printText,
    saveAsOrder,
  };
}

export type { Patient as PamiPlanillaPatient, Professional as PamiPlanillaProfessional };
