import { format } from "date-fns";
import { es } from "date-fns/locale";

import {
  medicalOrderDocumentHeading,
  medicalOrderDocumentTitle,
} from "@/features/recetas/utils/medical-order-document-title";
import type { MedicalOrderDocumentData } from "@/features/recetas/utils/print-medical-order-document";

type Props = {
  data: MedicalOrderDocumentData;
  className?: string;
};

export function MedicalOrderDocumentView({ data, className }: Props) {
  const insurance = [data.patient.insurance_provider, data.patient.insurance_number]
    .filter(Boolean)
    .join(" — ");

  return (
    <article
      className={className}
      aria-label={medicalOrderDocumentTitle(data.orderType)}
    >
      <header className="border-b-2 border-teal-600 pb-3 text-center">
        <p className="text-[11px] uppercase tracking-wide text-slate-500">República Argentina — DrFlow</p>
        <h2 className="mt-1 text-xl font-serif font-bold tracking-wide text-slate-900">
          {medicalOrderDocumentHeading(data.orderType)}
        </h2>
        <p className="mt-2 text-xs text-slate-600">
          Emitida el {format(new Date(data.issuedAt), "PPP 'a las' HH:mm", { locale: es })}
        </p>
      </header>

      <section className="mt-4 space-y-1 text-sm">
        <h3 className="text-xs font-bold uppercase tracking-wide text-teal-700">Establecimiento</h3>
        <p className="font-semibold text-slate-900">{data.clinic.name}</p>
        {data.clinic.address ? <p className="text-slate-700">{data.clinic.address}</p> : null}
        {data.clinic.phone ? <p className="text-slate-700">Tel: {data.clinic.phone}</p> : null}
      </section>

      <section className="mt-4 space-y-1 text-sm">
        <h3 className="text-xs font-bold uppercase tracking-wide text-teal-700">Paciente</h3>
        <p className="font-semibold text-slate-900">
          {data.patient.last_name}, {data.patient.first_name}
        </p>
        <p className="text-slate-700">DNI: {data.patient.document_number}</p>
        {data.patient.birth_date ? (
          <p className="text-slate-700">
            F. nac.: {format(new Date(data.patient.birth_date), "PP", { locale: es })}
          </p>
        ) : null}
        {insurance ? <p className="text-slate-700">Cobertura: {insurance}</p> : null}
      </section>

      <section className="mt-4 space-y-1 text-sm">
        <h3 className="text-xs font-bold uppercase tracking-wide text-teal-700">Profesional</h3>
        <p className="text-slate-900">Dr/a. {data.professional.full_name}</p>
        {data.professional.license_number ? (
          <p className="text-slate-700">Matrícula: {data.professional.license_number}</p>
        ) : null}
        {data.professional.specialty ? (
          <p className="text-slate-700">Especialidad: {data.professional.specialty}</p>
        ) : null}
      </section>

      <section className="mt-5">
        <h3 className="text-xs font-bold uppercase tracking-wide text-teal-700">Solicitud</h3>
        <div className="mt-2 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm leading-relaxed whitespace-pre-wrap text-slate-900">
          {data.orderText}
        </div>
      </section>

      {data.notes?.trim() ? (
        <section className="mt-4">
          <h3 className="text-xs font-bold uppercase tracking-wide text-teal-700">
            Indicaciones para el paciente
          </h3>
          <div className="mt-2 rounded-lg border border-slate-200 bg-white p-3 text-sm whitespace-pre-wrap text-slate-800">
            {data.notes.trim()}
          </div>
        </section>
      ) : null}

      <footer className="mt-6 border-t border-slate-200 pt-3 text-[10px] text-slate-500">
        Documento generado electrónicamente en DrFlow. Verifique datos del paciente antes de presentar.
      </footer>
    </article>
  );
}
