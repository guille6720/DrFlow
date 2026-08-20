"use client";

import Link from "next/link";

import { useEntitlementsSnapshot } from "@/core/components/entitlements/entitlements-provider";

const STATUS_COPY: Record<string, string> = {
  past_due: "El plan comercial figura como vencido. El consultorio clínico sigue; los extras del plan están en pausa.",
  cancelled: "La suscripción comercial está cancelada. El consultorio clínico sigue; los extras del plan están en pausa.",
  expired: "La suscripción comercial expiró. El consultorio clínico sigue; los extras del plan están en pausa.",
};

export function CommercialStatusBanner() {
  const snapshot = useEntitlementsSnapshot();
  if (!snapshot?.catalogAvailable) return null;
  const status = snapshot.status;
  if (!status || !(status in STATUS_COPY)) return null;

  return (
    <div role="status" className="border-b border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-950">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-2 lg:pl-64">
        <p className="flex-1">{STATUS_COPY[status]}</p>
        <Link
          href="/configuracion?grupo=consultorio&seccion=plan"
          className="font-medium underline underline-offset-2 hover:no-underline"
        >
          Ver plan
        </Link>
      </div>
    </div>
  );
}
