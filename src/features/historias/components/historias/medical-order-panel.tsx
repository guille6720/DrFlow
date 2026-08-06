"use client";

import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { voidMedicalOrder } from "@/features/recetas/actions/medical-orders";
import { MedicalOrderActions } from "@/features/recetas/components/recetas/medical-order-actions";
import { MedicalOrderForm } from "@/features/recetas/components/recetas/medical-order-form";
import { buildMedicalOrderDocumentData } from "@/features/recetas/utils/build-medical-order-document-data";
import { orderTypeLabel } from "@/features/recetas/utils/order-type-label";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { MedicalOrder } from "@/types/medical-order";

interface Professional {
  id: string;
  license_number?: string | null;
  display_name?: string | null;
  profiles?: { full_name: string } | null;
  specialties?: { name?: string | null } | null;
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
  orders: MedicalOrder[];
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
        <div className="mb-6 border-b border-slate-100 pb-6">
          <MedicalOrderForm
            patientId={patient.id}
            clinicalRecordId={clinicalRecordId}
            professionals={professionals}
            defaultProfessionalId={defaultProfessionalId}
            onSuccess={() => setShowForm(false)}
          />
        </div>
      )}

      {orders.length === 0 ? (
        <p className="text-sm text-slate-500">No hay órdenes ni derivaciones en esta consulta.</p>
      ) : (
        <ul className="space-y-3">
          {orders.map((order) => {
            const typedOrder = order as MedicalOrder & { order_type?: string };
            const documentData = buildMedicalOrderDocumentData(
              typedOrder,
              patient,
              clinic,
              professionals
            );
            const isVoid = order.status === "void";

            return (
              <li key={order.id} className="rounded-xl border border-slate-200 p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                      {orderTypeLabel(typedOrder.order_type)}
                    </span>
                    <p className="text-xs text-slate-500">
                      {format(new Date(order.issued_at), "PPp", { locale: es })}
                    </p>
                  </div>
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
                <MedicalOrderActions data={documentData} disabled={isVoid} />
                {canIssue && !isVoid ? (
                  <Button
                    className="mt-2"
                    size="sm"
                    variant="outline"
                    loading={acting === order.id}
                    onClick={() => handleVoid(order.id)}
                  >
                    Anular
                  </Button>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
