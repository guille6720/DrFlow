import { format } from "date-fns";
import { es } from "date-fns/locale";

import type { PrescriptionDocumentData } from "@/features/recetas/utils/print-prescription-document";

import { PRESCRIPTION_TYPE_LABELS } from "@/types/prescription";

type Props = {
  data: PrescriptionDocumentData;
  className?: string;
};

export function PrescriptionDocumentView({ data, className }: Props) {
  const insurance =
    data.patientInsurance ||
    [data.patient.insurance_provider, data.patient.insurance_number].filter(Boolean).join(" — ");

  return (
    <article
      className={className ? `drflow-medical-order-doc ${className}` : "drflow-medical-order-doc"}
      aria-label="Receta electrónica"
    >
      <header className="drflow-medical-order-doc-header border-b-2 border-teal-600 pb-3 text-center">
        <p className="drflow-medical-order-doc-kicker text-[11px] uppercase tracking-wide">
          República Argentina — DrFlow
        </p>
        <h2 className="drflow-medical-order-doc-heading mt-1 text-xl font-serif font-bold tracking-wide">
          RECETA ELECTRÓNICA
        </h2>
        <p className="drflow-medical-order-doc-meta mt-2 text-xs">
          N° {data.prescriptionNumber ?? "—"} ·{" "}
          {format(new Date(data.issuedAt), "PPP 'a las' HH:mm", { locale: es })} ·{" "}
          {PRESCRIPTION_TYPE_LABELS[data.prescriptionType]} · Vigencia {data.validityDays} días
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
          Prescriptor
        </h3>
        <p className="drflow-medical-order-doc-strong">Dr/a. {data.professional.full_name}</p>
        {data.professional.license_number ? (
          <p className="drflow-medical-order-doc-text">
            Matrícula: {data.professional.license_number}
          </p>
        ) : null}
        {data.professional.specialty ? (
          <p className="drflow-medical-order-doc-text">
            Especialidad: {data.professional.specialty}
          </p>
        ) : null}
      </section>

      <section className="mt-4 space-y-1 text-sm">
        <h3 className="drflow-medical-order-doc-section-title text-xs font-bold uppercase tracking-wide">
          Diagnóstico
        </h3>
        <p className="drflow-medical-order-doc-text">CIE-10: {data.diagnosisCie10 ?? "—"}</p>
        <div className="drflow-medical-order-doc-body-box mt-2 rounded-lg border p-3 text-sm whitespace-pre-wrap">
          {data.diagnosisText?.trim() || "—"}
        </div>
      </section>

      <section className="mt-5">
        <h3 className="drflow-medical-order-doc-section-title text-xs font-bold uppercase tracking-wide">
          Rp./
        </h3>
        <div className="mt-2 space-y-3">
          {data.medications.length === 0 ? (
            <p className="drflow-medical-order-doc-text text-sm">— Sin medicamentos —</p>
          ) : (
            data.medications.map((med, index) => (
              <div
                key={`${med.generic_name}-${index}`}
                className="drflow-medical-order-doc-body-box rounded-lg border p-3 text-sm"
              >
                <p className="drflow-medical-order-doc-strong font-semibold">
                  {index + 1}. {med.generic_name}
                </p>
                {med.brand_name ? (
                  <p className="drflow-medical-order-doc-text mt-1">
                    Marca sugerida: {med.brand_name}
                  </p>
                ) : null}
                <p className="drflow-medical-order-doc-text mt-1">
                  {[med.presentation, med.concentration, med.route, `Cant: ${med.quantity}`]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
                <p className="drflow-medical-order-doc-text mt-1 whitespace-pre-wrap">
                  Posología: {med.posology}
                </p>
              </div>
            ))
          )}
        </div>
      </section>

      {data.notes?.trim() ? (
        <section className="mt-4">
          <h3 className="drflow-medical-order-doc-section-title text-xs font-bold uppercase tracking-wide">
            Observaciones
          </h3>
          <div className="drflow-medical-order-doc-notes-box mt-2 rounded-lg border p-3 text-sm whitespace-pre-wrap">
            {data.notes.trim()}
          </div>
        </section>
      ) : null}

      <footer className="drflow-medical-order-doc-footer mt-6 border-t pt-3 text-[10px]">
        Receta generada electrónicamente en DrFlow. Verifique datos del paciente antes de presentar
        en farmacia.
      </footer>
    </article>
  );
}
