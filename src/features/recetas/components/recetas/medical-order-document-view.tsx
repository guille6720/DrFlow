import { format } from "date-fns";
import { es } from "date-fns/locale";

import { DocumentSignatureBlock } from "@/features/recetas/components/recetas/document-signature-block";
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
      className={className ? `drflow-medical-order-doc ${className}` : "drflow-medical-order-doc"}
      aria-label={medicalOrderDocumentTitle(data.orderType)}
    >
      <header className="drflow-medical-order-doc-header border-b-2 border-teal-600 pb-3 text-center">
        <p className="drflow-medical-order-doc-kicker text-[11px] uppercase tracking-wide">
          República Argentina — NexClinic
        </p>
        <h2 className="drflow-medical-order-doc-heading mt-1 text-xl font-serif font-bold tracking-wide">
          {medicalOrderDocumentHeading(data.orderType)}
        </h2>
        <p className="drflow-medical-order-doc-meta mt-2 text-xs">
          Emitida el {format(new Date(data.issuedAt), "PPP 'a las' HH:mm", { locale: es })}
        </p>
      </header>

      <section className="mt-4 space-y-1 text-sm">
        <h3 className="drflow-medical-order-doc-section-title text-xs font-bold uppercase tracking-wide">
          Establecimiento
        </h3>
        <p className="drflow-medical-order-doc-strong font-semibold">{data.clinic.name}</p>
        {data.clinic.address ? (
          <p className="drflow-medical-order-doc-text">{data.clinic.address}</p>
        ) : null}
        {data.clinic.phone ? (
          <p className="drflow-medical-order-doc-text">Tel: {data.clinic.phone}</p>
        ) : null}
      </section>

      <section className="mt-4 space-y-1 text-sm">
        <h3 className="drflow-medical-order-doc-section-title text-xs font-bold uppercase tracking-wide">
          Paciente
        </h3>
        <p className="drflow-medical-order-doc-strong font-semibold">
          {data.patient.last_name}, {data.patient.first_name}
        </p>
        <p className="drflow-medical-order-doc-text">DNI: {data.patient.document_number}</p>
        {data.patient.birth_date ? (
          <p className="drflow-medical-order-doc-text">
            F. nac.: {format(new Date(data.patient.birth_date), "PP", { locale: es })}
          </p>
        ) : null}
        {insurance ? <p className="drflow-medical-order-doc-text">Cobertura: {insurance}</p> : null}
      </section>

      <section className="mt-4 space-y-1 text-sm">
        <h3 className="drflow-medical-order-doc-section-title text-xs font-bold uppercase tracking-wide">
          Profesional
        </h3>
        <p className="drflow-medical-order-doc-strong">Dr/a. {data.professional.full_name}</p>
        {data.professional.license_number ? (
          <p className="drflow-medical-order-doc-text">Matrícula: {data.professional.license_number}</p>
        ) : null}
        {data.professional.specialty ? (
          <p className="drflow-medical-order-doc-text">Especialidad: {data.professional.specialty}</p>
        ) : null}
      </section>

      <section className="mt-5">
        <h3 className="drflow-medical-order-doc-section-title text-xs font-bold uppercase tracking-wide">
          Solicitud
        </h3>
        <div className="drflow-medical-order-doc-body-box mt-2 rounded-lg border p-4 text-sm leading-relaxed whitespace-pre-wrap">
          {data.orderText?.trim() ? data.orderText : "— Sin texto de solicitud —"}
        </div>
      </section>

      {data.notes?.trim() ? (
        <section className="mt-4">
          <h3 className="drflow-medical-order-doc-section-title text-xs font-bold uppercase tracking-wide">
            Indicaciones para el paciente
          </h3>
          <div className="drflow-medical-order-doc-notes-box mt-2 rounded-lg border p-3 text-sm whitespace-pre-wrap">
            {data.notes.trim()}
          </div>
        </section>
      ) : null}

      <DocumentSignatureBlock
        signature={{
          signatureText: data.professional.signatureText,
          signatureImageUrl: data.professional.signatureImageUrl,
        }}
      />

      <footer className="drflow-medical-order-doc-footer mt-6 border-t pt-3 text-[10px]">
        Documento generado electrónicamente en NexClinic. Verifique datos del paciente antes de presentar.
      </footer>
    </article>
  );
}
