"use client";

import { FileText, Stethoscope } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { OrderPhysicianAssist } from "@/features/ia/components/clinical-workflow/order-physician-assist";
import type { PhysicianAssistContext } from "@/features/ia/types/physician-assist-types";
import { createMedicalOrder } from "@/features/recetas/actions/medical-orders";

import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { PAMI_REFERRAL_TEMPLATES, PAMI_STUDY_TEMPLATES } from "@/lib/constants/pami-cabecera";
import { getProfessionalDisplayName } from "@/lib/utils/professional";

interface Professional {
  id: string;
  license_number?: string | null;
  display_name?: string | null;
  profiles?: { full_name: string } | null;
}

interface Props {
  patientId: string;
  clinicalRecordId?: string;
  professionals: Professional[];
  defaultProfessionalId?: string;
  onSuccess?: () => void;
  assistContext?: PhysicianAssistContext;
}

export function MedicalOrderForm({
  patientId,
  clinicalRecordId,
  professionals,
  defaultProfessionalId,
  onSuccess,
  assistContext,
}: Props) {
  const router = useRouter();
  const [orderType, setOrderType] = useState<"study" | "referral">("study");
  const [orderText, setOrderText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const templates = orderType === "study" ? PAMI_STUDY_TEMPLATES : PAMI_REFERRAL_TEMPLATES;

  function applyTemplate(text: string) {
    setOrderText(text);
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const formData = new FormData(e.currentTarget);
    formData.set("patient_id", patientId);
    if (clinicalRecordId) formData.set("clinical_record_id", clinicalRecordId);
    formData.set("order_type", orderType);
    const result = await createMedicalOrder(formData);
    setLoading(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    onSuccess?.();
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          variant={orderType === "study" ? "primary" : "outline"}
          onClick={() => setOrderType("study")}
        >
          <FileText className="h-4 w-4" />
          Estudios
        </Button>
        <Button
          type="button"
          size="sm"
          variant={orderType === "referral" ? "primary" : "outline"}
          onClick={() => setOrderType("referral")}
        >
          <Stethoscope className="h-4 w-4" />
          Derivación
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        {templates.map((t) => (
          <button
            key={t.label}
            type="button"
            onClick={() => applyTemplate(t.text)}
            className="rounded-full border border-teal-200 bg-teal-50 px-3 py-1 text-xs font-medium text-teal-800 hover:bg-teal-100"
          >
            {t.label}
          </button>
        ))}
      </div>

      <Textarea
        id="order-text-field"
        name="order_text"
        label={orderType === "study" ? "Estudios / análisis" : "Texto de derivación"}
        required
        rows={6}
        voiceInput
        value={orderText}
        onChange={(e) => setOrderText(e.target.value)}
        placeholder={
          orderType === "study"
            ? "Control de diabetes, hemograma, ECG..."
            : "Derivación a especialista..."
        }
      />

      {assistContext ? (
        <OrderPhysicianAssist
          context={assistContext}
          orderIntentText={orderText}
          onApplyOrderText={setOrderText}
        />
      ) : null}

      <Select
        name="professional_id"
        label="Profesional"
        required
        defaultValue={defaultProfessionalId}
        options={professionals.map((p) => ({
          value: p.id,
          label: getProfessionalDisplayName(p),
        }))}
        placeholder="Seleccionar"
      />

      <Textarea
        name="notes"
        label="Indicaciones para el paciente"
        rows={2}
        placeholder="Ayuno, preparación, turno en PAMI..."
      />
      {error && <p className="text-sm text-red-600">{error}</p>}
      <Button type="submit" loading={loading}>
        Generar {orderType === "study" ? "orden de estudios" : "derivación"}
      </Button>
    </form>
  );
}
