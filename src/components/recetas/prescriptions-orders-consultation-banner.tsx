"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { buildConsultaHref } from "@/lib/utils/consultation-draft";
import type { ConsultationDraftContext } from "@/lib/utils/consultation-draft";

type Props = {
  consultationContext: ConsultationDraftContext;
  consultaMedicationsCount: number;
};

export function PrescriptionsOrdersConsultationBanner({
  consultationContext,
  consultaMedicationsCount,
}: Props) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-teal-500/40 bg-teal-950/50 px-4 py-3">
      <Link
        href={buildConsultaHref(consultationContext)}
        className="inline-flex items-center gap-2 rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-teal-500"
      >
        <ArrowLeft className="h-4 w-4" />
        {consultationContext.recordId ? "Volver a editar consulta" : "Volver a consulta en curso"}
      </Link>
      <p className="text-sm text-teal-100">
        {consultaMedicationsCount > 0
          ? `${consultaMedicationsCount} medicamento(s) precargado(s) desde la evolución.`
          : "La evolución de la consulta se usará como diagnóstico si no hay medicación con viñeta."}
      </p>
    </div>
  );
}
