"use client";

import { format } from "date-fns";
import { es } from "date-fns/locale";

import { MedicalOrderActions } from "@/features/recetas/components/recetas/medical-order-actions";
import { buildMedicalOrderDocumentData } from "@/features/recetas/utils/build-medical-order-document-data";
import { orderTypeLabel } from "@/features/recetas/utils/order-type-label";

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
  profiles?: { full_name?: string | null } | null;
  specialties?: { name?: string | null } | null;
};

type ClinicInfo = {
  name: string;
  address?: string | null;
  phone?: string | null;
};

type Props = {
  orders: (MedicalOrder & { order_type?: string })[];
  patient: PatientInfo;
  clinic: ClinicInfo;
  professionals: ProfessionalInfo[];
};

export function MedicalOrderList({ orders, patient, clinic, professionals }: Props) {
  return (
    <ul className="space-y-3 text-sm">
      {orders.map((order) => {
        const documentData = buildMedicalOrderDocumentData(order, patient, clinic, professionals);
        const isVoid = order.status === "void";

        return (
          <li key={order.id} className="rounded-lg border border-slate-200 p-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-medium text-slate-600">
                {orderTypeLabel(order.order_type)}
              </span>
              <Badge variant={isVoid ? "danger" : "success"}>
                {isVoid ? "Anulada" : "Emitida"}
              </Badge>
            </div>
            <p className="mt-1 text-xs text-slate-500">
              {format(new Date(order.issued_at), "PPp", { locale: es })}
            </p>
            <p className="mt-2 whitespace-pre-wrap text-slate-800">{order.order_text}</p>
            {order.notes ? (
              <p className="mt-2 text-xs text-slate-600">Indicaciones: {order.notes}</p>
            ) : null}
            <MedicalOrderActions data={documentData} disabled={isVoid} />
          </li>
        );
      })}
    </ul>
  );
}
