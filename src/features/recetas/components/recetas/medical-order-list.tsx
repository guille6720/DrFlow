"use client";

import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Eye, Printer } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { cn } from "@/shared/utils/cn";

import { voidMedicalOrder } from "@/features/recetas/actions/medical-orders";
import { MedicalOrderActionButtons } from "@/features/recetas/components/recetas/medical-order-action-buttons";
import { MedicalOrderEditSheet } from "@/features/recetas/components/recetas/medical-order-edit-sheet";
import { MedicalOrderPreviewSheet } from "@/features/recetas/components/recetas/medical-order-preview-sheet";
import { isMedicalOrderConflictError } from "@/features/recetas/repositories/medical-orders.errors";
import { buildMedicalOrderDocumentData } from "@/features/recetas/utils/build-medical-order-document-data";
import { normalizeMedicalOrderVersion } from "@/features/recetas/utils/medical-order-version";
import { orderTypeLabel } from "@/features/recetas/utils/order-type-label";
import { printMedicalOrderDocument } from "@/features/recetas/utils/print-medical-order-document";

import { Badge } from "@/components/ui/badge";
import type { MedicalOrder } from "@/types/medical-order";

type PatientInfo = {
  first_name: string;
  last_name: string;
  document_number: string;
  birth_date?: string | null;
  insurance_provider?: string | null;
  insurance_number?: string | null;
};

type ProfessionalInfo = {
  id: string;
  display_name?: string | null;
  license_number?: string | null;
  license_national?: string | null;
  license_provincial?: string | null;
  signature_text?: string | null;
  signature_image_url?: string | null;
  profiles?: { full_name?: string | null } | null;
  specialties?: { name?: string | null } | { name?: string | null }[] | null;
};

type ClinicInfo = {
  name: string;
  address?: string | null;
  phone?: string | null;
};

type Props = {
  orders: (MedicalOrder & { order_type?: string })[];
  patient: PatientInfo;
  patientId: string;
  clinic: ClinicInfo;
  professionals: ProfessionalInfo[];
  canManage?: boolean;
};

export function MedicalOrderList({
  orders,
  patient,
  patientId,
  clinic,
  professionals,
  canManage = false,
}: Props) {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState<string | null>(orders[0]?.id ?? null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editingOrder, setEditingOrder] = useState<(MedicalOrder & { order_type?: string }) | null>(
    null
  );
  const [actingId, setActingId] = useState<string | null>(null);

  const documentsById = useMemo(() => {
    const map = new Map<string, ReturnType<typeof buildMedicalOrderDocumentData>>();
    for (const order of orders) {
      map.set(order.id, buildMedicalOrderDocumentData(order, patient, clinic, professionals));
    }
    return map;
  }, [clinic, orders, patient, professionals]);

  const selectedDocument = selectedId ? documentsById.get(selectedId) ?? null : null;

  function openPreview(orderId: string) {
    setSelectedId(orderId);
    setPreviewOpen(true);
  }

  function selectOrder(orderId: string) {
    setSelectedId(orderId);
  }

  function openEdit(order: MedicalOrder & { order_type?: string }) {
    setEditingOrder(order);
    setEditOpen(true);
  }

  async function handleDelete(order: MedicalOrder & { order_type?: string }) {
    if (
      !confirm(
        `¿Eliminar esta orden de ${orderTypeLabel(order.order_type)}?\n\nSe marcará como anulada y dejará de estar disponible para imprimir.`
      )
    ) {
      return;
    }

    setActingId(order.id);
    const result = await voidMedicalOrder(order.id, normalizeMedicalOrderVersion(order.version));
    setActingId(null);

    if (result.error) {
      if (isMedicalOrderConflictError(result.error)) {
        router.refresh();
      }
      alert(result.error);
      return;
    }

    if (selectedId === order.id) {
      setSelectedId(null);
    }
    router.refresh();
  }

  return (
    <>
      {selectedDocument ? (
        <div className="drflow-medical-order-toolbar mb-3 flex flex-wrap items-center gap-2 rounded-lg border border-blue-200 bg-blue-50/90 px-3 py-2">
          <p className="min-w-0 flex-1 text-sm font-medium text-blue-950">
            Orden seleccionada — {orderTypeLabel(selectedDocument.orderType)}
          </p>
          <button
            type="button"
            className="drflow-medical-order-action-btn inline-flex items-center gap-1.5 rounded-lg border border-blue-300 bg-blue-50 px-3 py-1.5 text-sm font-medium text-blue-900 hover:bg-blue-100"
            onClick={() => setPreviewOpen(true)}
          >
            <Eye className="h-4 w-4" aria-hidden />
            Vista previa
          </button>
          <button
            type="button"
            className="drflow-medical-order-action-btn inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-800 hover:bg-slate-50"
            onClick={() => printMedicalOrderDocument(selectedDocument)}
          >
            <Printer className="h-4 w-4" aria-hidden />
            Imprimir seleccionada
          </button>
        </div>
      ) : null}

      <ul className="space-y-3 text-sm">
        {orders.map((order) => {
          const documentData = documentsById.get(order.id)!;
          const isVoid = order.status === "void";
          const isSelected = selectedId === order.id;

          return (
            <li
              key={order.id}
              className={cn(
                "drflow-medical-order-row rounded-lg border transition",
                isSelected
                  ? "border-blue-400 bg-blue-50/70 ring-2 ring-blue-300"
                  : "border-slate-200 bg-white hover:border-blue-200 hover:bg-slate-50"
              )}
            >
              <div className="flex flex-wrap items-start justify-between gap-3 p-3">
                <button
                  type="button"
                  onClick={() => {
                    if (isVoid) {
                      selectOrder(order.id);
                      return;
                    }
                    openPreview(order.id);
                  }}
                  className="min-w-0 flex-1 text-left"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-semibold uppercase tracking-wide text-slate-700">
                      {orderTypeLabel(order.order_type)}
                    </span>
                    <Badge variant={isVoid ? "danger" : "success"}>
                      {isVoid ? "Anulada" : "Emitida"}
                    </Badge>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    {format(new Date(order.issued_at), "PPp", { locale: es })}
                  </p>
                  <p className="mt-2 line-clamp-3 whitespace-pre-wrap text-slate-800">
                    {order.order_text}
                  </p>
                  {order.notes ? (
                    <p className="mt-2 text-xs text-slate-600">Indicaciones: {order.notes}</p>
                  ) : null}
                  {!isVoid ? (
                    <p className="mt-2 text-xs font-medium text-blue-700">
                      Clic para vista previa · Usá los botones para imprimir
                    </p>
                  ) : null}
                </button>
                {!isVoid ? (
                  <MedicalOrderActionButtons
                    compact
                    data={documentData}
                    onPreview={() => openPreview(order.id)}
                    onEdit={canManage ? () => openEdit(order) : undefined}
                    onDelete={canManage ? () => handleDelete(order) : undefined}
                    acting={actingId === order.id}
                  />
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>

      {selectedDocument ? (
        <MedicalOrderPreviewSheet
          open={previewOpen}
          data={selectedDocument}
          onClose={() => setPreviewOpen(false)}
        />
      ) : null}

      <MedicalOrderEditSheet
        open={editOpen}
        order={editingOrder}
        patientId={patientId}
        professionals={professionals}
        onClose={() => {
          setEditOpen(false);
          setEditingOrder(null);
        }}
        onSaved={() => router.refresh()}
      />
    </>
  );
}
