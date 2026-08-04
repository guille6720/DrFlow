import Link from "next/link";
import { ArrowLeft, Check } from "lucide-react";
import { buildConsultaHref } from "@/lib/utils/consultation-draft";
import type { ConsultationDraftContext } from "@/lib/utils/consultation-draft";

interface Props {
  consultationContext: ConsultationDraftContext;
  addedMessage: string | null;
}

export function PharmacologyConsultationBanner({ consultationContext, addedMessage }: Props) {
  return (
    <div className="mx-4 mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-teal-500/40 bg-teal-950/50 px-4 py-3 sm:mx-6">
      <Link
        href={buildConsultaHref(consultationContext)}
        className="inline-flex items-center gap-2 rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-teal-500"
      >
        <ArrowLeft className="h-4 w-4" />
        {consultationContext.recordId ? "Volver a editar consulta" : "Volver a consulta en curso"}
      </Link>
      <p className="text-sm text-teal-100">
        {addedMessage ? (
          <span className="inline-flex items-center gap-1.5 font-medium text-teal-200">
            <Check className="h-4 w-4" />
            {addedMessage}
          </span>
        ) : (
          "Hacé clic en un medicamento para agregarlo a la evolución."
        )}
      </p>
    </div>
  );
}
