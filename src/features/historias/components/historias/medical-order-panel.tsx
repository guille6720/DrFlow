"use client";

import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { cn } from "@/shared/utils/cn";

import type { HistoriaMedicalOrderSummary } from "@/features/historias/types/historia-clinical-summaries";
import { voidMedicalOrder } from "@/features/recetas/actions/medical-orders";
import { MedicalOrderActionButtons } from "@/features/recetas/components/recetas/medical-order-action-buttons";
import { MedicalOrderEditSheet } from "@/features/recetas/components/recetas/medical-order-edit-sheet";
import { MedicalOrderForm } from "@/features/recetas/components/recetas/medical-order-form";
import { MedicalOrderPreviewSheet } from "@/features/recetas/components/recetas/medical-order-preview-sheet";
import { isMedicalOrderConflictError } from "@/features/recetas/repositories/medical-orders.errors";
import { buildMedicalOrderDocumentData } from "@/features/recetas/utils/build-medical-order-document-data";
import { normalizeMedicalOrderVersion } from "@/features/recetas/utils/medical-order-version";
import { orderTypeLabel } from "@/features/recetas/utils/order-type-label";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

interface Professional {
  id: string;
  license_number?: string | null;
  display_name?: string | null;
  profiles?: { full_name?: string | null } | null;
  specialties?: { name?: string | null } | { name?: string | null }[] | null;
}

interface PatientInfo {
  id: string;
  first_name: string;
  last_name: string;
  document_number: string;
  birth_date?: string | null;
  insurance_provider?: string | null;
  insurance_number?: string | null;
}

interface Props {
  orders: HistoriaMedicalOrderSummary[];
  patient: PatientInfo;
  clinicalRecordId: string;
  professionals: Professional[];
  defaultProfessionalId?: string;
  clinic: {
    name: string;
    address?: string | null;
    phone?: string | null;
  };
  canIssue: boolean;
}

export function MedicalOrderPanel({
  orders,
  patient,
  clinicalRecordId,
  professionals,
  defaultProfessionalId,
  clinic,
  canIssue,
}: Props) {
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);
  const [acting, setActing] = useState<string | null>(null);
  const [, startRefresh] = useTransition();
  const [previewOpen, setPreviewOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editingOrder, setEditingOrder] = useState<HistoriaMedicalOrderSummary | null>(null);
  const [previewData, setPreviewData] = useState<ReturnType<typeof buildMedicalOrderDocumentData> | null>(
    null
  );

  function openEdit(order: HistoriaMedicalOrderSummary) {
    setEditingOrder(order);
    setEditOpen(true);
  }

  async function handleDelete(order: HistoriaMedicalOrderSummary & { order_type?: string }) {
    if (
      !confirm(
        `¿Eliminar esta orden de ${orderTypeLabel(order.order_type)}?\n\nSe marcará como anulada y dejará de estar disponible para imprimir.`
      )
    ) {
      return;
    }

    setActing(order.id);
    const result = await voidMedicalOrder(order.id, normalizeMedicalOrderVersion(order.version));
    setActing(null);

    if (result.error) {
      if (isMedicalOrderConflictError(result.error)) {
        startRefresh(() => {
          router.refresh();
        });
      }
      alert(result.error);
      return;
    }

    startRefresh(() => {
      router.refresh();
    });
  }

  function openPreview(order: HistoriaMedicalOrderSummary & { order_type?: string }) {
    setPreviewData(buildMedicalOrderDocumentData(order, patient, clinic, professionals));
    setPreviewOpen(true);
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
        <div className="mb-6 border-b border-slate-100 pb-6">
          <MedicalOrderForm
            patientId={patient.id}
            clinicalRecordId={clinicalRecordId}
            professionals={professionals}
            defaultProfessionalId={defaultProfessionalId}
            onSuccess={(order) => {
              setShowForm(false);
              if (order) {
                openPreview(order);
              }
              startRefresh(() => {
                router.refresh();
              });
            }}
          />
        </div>
      )}

      {orders.length === 0 ? (
        <p className="text-sm text-slate-500">No hay órdenes ni derivaciones en esta consulta.</p>
      ) : (
        <ul className="space-y-3">
          {orders.map((order) => {
            const documentData = buildMedicalOrderDocumentData(
              order,
              patient,
              clinic,
              professionals
            );
            const isVoid = order.status === "void";

            return (
              <li
                key={order.id}
                className={cn(
                  "drflow-medical-order-row rounded-xl border transition",
                  isVoid
                    ? "border-slate-200 bg-slate-50 opacity-80"
                    : "border-slate-200 bg-white hover:border-blue-200 hover:bg-slate-50"
                )}
              >
                <div className="flex flex-wrap items-start justify-between gap-3 p-4">
                  <button
                    type="button"
                    disabled={isVoid}
                      onClick={() => openPreview(order)}
                    className={cn(
                      "min-w-0 flex-1 text-left",
                      isVoid ? "cursor-default" : "cursor-pointer"
                    )}
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                        {orderTypeLabel(order.order_type)}
                      </span>
                      <p className="text-xs text-slate-500">
                        {format(new Date(order.issued_at), "PPp", { locale: es })}
                      </p>
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          isVoid ? "bg-red-100 text-red-800" : "bg-emerald-100 text-emerald-800"
                        }`}
                      >
                        {isVoid ? "Anulada" : "Emitida"}
                      </span>
                    </div>
                    <p className="mt-2 whitespace-pre-wrap text-sm text-slate-800">{order.order_text}</p>
                    {order.notes ? (
                      <p className="mt-2 text-xs text-slate-600">Indicaciones: {order.notes}</p>
                    ) : null}
                    {!isVoid ? (
                      <p className="mt-2 text-xs font-medium text-blue-700">Clic para abrir vista previa</p>
                    ) : null}
                  </button>
                  {!isVoid ? (
                    <MedicalOrderActionButtons
                      compact
                      data={documentData}
                      onPreview={() => openPreview(order)}
                      onEdit={canIssue ? () => openEdit(order) : undefined}
                      onDelete={canIssue ? () => handleDelete(order) : undefined}
                      acting={acting === order.id}
                    />
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {previewData ? (
        <MedicalOrderPreviewSheet
          open={previewOpen}
          data={previewData}
          onClose={() => setPreviewOpen(false)}
        />
      ) : null}

      <MedicalOrderEditSheet
        open={editOpen}
        order={editingOrder}
        patientId={patient.id}
        professionals={professionals}
        onClose={() => {
          setEditOpen(false);
          setEditingOrder(null);
        }}
        onSaved={() => router.refresh()}
      />
    </Card>
  );
}
