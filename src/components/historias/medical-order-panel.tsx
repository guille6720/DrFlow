"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { createMedicalOrder, voidMedicalOrder } from "@/lib/actions/medical-orders";
import { PAMI_REFERRAL_TEMPLATES, PAMI_STUDY_TEMPLATES } from "@/lib/constants/pami-cabecera";
import { getProfessionalDisplayName } from "@/lib/utils/professional";
import type { MedicalOrder } from "@/types/medical-order";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { FileText, Plus, Stethoscope } from "lucide-react";

interface Professional {
  id: string;
  license_number?: string | null;
  display_name?: string | null;
  profiles?: { full_name: string } | null;
}

interface Props {
  orders: MedicalOrder[];
  patientId: string;
  clinicalRecordId: string;
  professionals: Professional[];
  defaultProfessionalId?: string;
  canIssue: boolean;
}

export function MedicalOrderPanel({
  orders,
  patientId,
  clinicalRecordId,
  professionals,
  defaultProfessionalId,
  canIssue,
}: Props) {
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);
  const [orderType, setOrderType] = useState<"study" | "referral">("study");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [acting, setActing] = useState<string | null>(null);

  const templates = orderType === "study" ? PAMI_STUDY_TEMPLATES : PAMI_REFERRAL_TEMPLATES;

  function applyTemplate(text: string) {
    const el = document.getElementById("order-text-field") as HTMLTextAreaElement | null;
    if (el) el.value = text;
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const formData = new FormData(e.currentTarget);
    formData.set("patient_id", patientId);
    formData.set("clinical_record_id", clinicalRecordId);
    formData.set("order_type", orderType);
    const result = await createMedicalOrder(formData);
    setLoading(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setShowForm(false);
    router.refresh();
  }

  async function handleVoid(id: string) {
    setActing(id);
    await voidMedicalOrder(id);
    setActing(null);
    router.refresh();
  }

  return (
    <Card title="Estudios y derivaciones PAMI">
      {canIssue && (
        <div className="mb-4 flex flex-wrap gap-2">
          <Button type="button" size="sm" variant="outline" onClick={() => setShowForm(!showForm)}>
            <Plus className="h-4 w-4" />
            {showForm ? "Ocultar" : "Nueva orden"}
          </Button>
        </div>
      )}

      {showForm && canIssue && (
        <form onSubmit={handleSubmit} className="mb-6 space-y-3 border-b border-slate-100 pb-6">
          <div className="flex gap-2">
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
                className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-medium text-blue-800 hover:bg-blue-100"
              >
                {t.label}
              </button>
            ))}
          </div>

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
            id="order-text-field"
            name="order_text"
            label={orderType === "study" ? "Estudios / análisis" : "Texto de derivación"}
            required
            rows={5}
            placeholder={
              orderType === "study"
                ? "Hemograma, glucemia, ECG..."
                : "Derivación a especialista..."
            }
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
      )}

      {orders.length === 0 ? (
        <p className="text-sm text-slate-500">No hay órdenes ni derivaciones en esta consulta.</p>
      ) : (
        <ul className="space-y-3">
          {orders.map((order) => (
            <li key={order.id} className="rounded-xl border border-slate-200 p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                    {(order as MedicalOrder & { order_type?: string }).order_type === "referral"
                      ? "Derivación"
                      : (order as MedicalOrder & { order_type?: string }).order_type === "pami_form"
                        ? "Planilla PAMI"
                        : "Estudios"}
                  </span>
                  <p className="text-xs text-slate-500">
                    {format(new Date(order.issued_at), "PPp", { locale: es })}
                  </p>
                </div>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                    order.status === "void"
                      ? "bg-red-100 text-red-800"
                      : "bg-emerald-100 text-emerald-800"
                  }`}
                >
                  {order.status === "void" ? "Anulada" : "Emitida"}
                </span>
              </div>
              <p className="mt-2 whitespace-pre-wrap text-sm text-slate-800">{order.order_text}</p>
              {order.notes && (
                <p className="mt-2 text-xs text-slate-600">Indicaciones: {order.notes}</p>
              )}
              {canIssue && order.status !== "void" && (
                <Button
                  className="mt-3"
                  size="sm"
                  variant="outline"
                  loading={acting === order.id}
                  onClick={() => handleVoid(order.id)}
                >
                  Anular
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
