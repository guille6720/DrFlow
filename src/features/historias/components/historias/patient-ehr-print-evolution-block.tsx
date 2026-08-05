import { format } from "date-fns";
import { es } from "date-fns/locale";

import { patientEhrEvolutionBody } from "@/features/historias/components/historias/patient-ehr-utils";
import type { PatientEhrConsultation } from "@/features/pacientes/utils/patient-ehr-model";

type Props = {
  consultation: PatientEhrConsultation;
};

export function PatientEhrPrintEvolutionBlock({ consultation }: Props) {
  return (
    <article className="drflow-ehr-print-evolution break-inside-avoid rounded-sm border border-slate-200 p-4">
      <p className="mb-2 text-xs text-slate-600">
        {format(new Date(consultation.created_at), "EEEE d MMMM yyyy · HH:mm", {
          locale: es,
        })}{" "}
        · {consultation.professional_name}
      </p>
      <div className="whitespace-pre-wrap text-sm leading-relaxed text-slate-900">
        {consultation.category === "document" ? (
          <p>{consultation.diagnosis?.trim() || consultation.chief_complaint || "Documento adjunto"}</p>
        ) : (
          patientEhrEvolutionBody(consultation)
        )}
      </div>
    </article>
  );
}
