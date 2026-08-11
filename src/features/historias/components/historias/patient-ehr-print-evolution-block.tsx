import {
  formatPrintHeaderDate,
  formatPrintTime,
  parseInlineDiagnoses,
  parseInlineTreatments,
  professionalMetaLine,
} from "@/features/historias/components/historias/patient-ehr-print-utils";
import { patientEhrEvolutionBody } from "@/features/historias/components/historias/patient-ehr-utils";
import type { PatientEhrConsultation } from "@/features/pacientes/utils/patient-ehr-model";
import { DocumentSignatureBlock } from "@/features/recetas/components/recetas/document-signature-block";

import type { DocumentSignature } from "@/lib/utils/professional-signature-document";

type Props = {
  consultation: PatientEhrConsultation;
  signature?: DocumentSignature | null;
};

export function PatientEhrPrintEvolutionBlock({ consultation, signature = null }: Props) {
  const diagnoses = parseInlineDiagnoses(consultation);
  const treatments = parseInlineTreatments(consultation);
  const evolutionText =
    consultation.category === "document"
      ? consultation.diagnosis?.trim() || consultation.chief_complaint || "Documento adjunto"
      : patientEhrEvolutionBody(consultation);

  return (
    <article className="drflow-ehr-print-evolution break-inside-avoid">
      <header className="drflow-ehr-print-evolution-header">
        <h2 className="drflow-ehr-print-evolution-title">
          {formatPrintHeaderDate(consultation.created_at)} {consultation.professional_name}
        </h2>
      </header>

      <section className="drflow-ehr-print-section">
        <h3 className="drflow-ehr-print-section-title">Evoluciones</h3>
        <p className="drflow-ehr-print-meta">
          <span className="drflow-ehr-print-meta-time">{formatPrintTime(consultation.created_at)}</span>
          <span>{professionalMetaLine(consultation)}</span>
        </p>
        <div className="drflow-ehr-print-evolution-body whitespace-pre-wrap">{evolutionText}</div>
      </section>

      {diagnoses.length > 0 ? (
        <section className="drflow-ehr-print-section">
          <h3 className="drflow-ehr-print-section-title">Diagnósticos</h3>
          <ul className="drflow-ehr-print-list">
            {diagnoses.map((item) => (
              <li key={item.text}>
                <span>{item.text}</span>
                {item.code ? <span className="drflow-ehr-print-diagnosis-code">{item.code}</span> : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {treatments.length > 0 ? (
        <section className="drflow-ehr-print-section">
          <h3 className="drflow-ehr-print-section-title">Tratamientos</h3>
          <ul className="drflow-ehr-print-treatment-list">
            {treatments.map((item) => (
              <li key={`${item.product}-${item.dose}`} className="drflow-ehr-print-treatment-item">
                <p className="drflow-ehr-print-treatment-product-line">
                  <span className="drflow-ehr-print-treatment-product">{item.product}</span>
                  {item.lab ? (
                    <span className="drflow-ehr-print-treatment-lab">{item.lab}</span>
                  ) : null}
                </p>
                {item.dose ? <p className="drflow-ehr-print-treatment-dose">{item.dose}</p> : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {signature ? (
        <DocumentSignatureBlock signature={signature} className="drflow-ehr-print-signature mt-4" />
      ) : null}
    </article>
  );
}
