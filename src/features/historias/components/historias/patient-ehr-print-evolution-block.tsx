import {
  formatPrintHeaderDate,
  formatPrintTime,
  parseInlineDiagnoses,
  parseInlineTreatments,
  professionalMetaLine,
} from "@/features/historias/components/historias/patient-ehr-print-utils";
import { patientEhrEvolutionBody } from "@/features/historias/components/historias/patient-ehr-utils";
import type { PatientEhrConsultation } from "@/features/pacientes/utils/patient-ehr-model";

type Props = {
  consultation: PatientEhrConsultation;
};

function LockIcon() {
  return (
    <svg
      className="drflow-ehr-print-lock-icon"
      viewBox="0 0 16 16"
      aria-hidden="true"
      focusable="false"
    >
      <path
        fill="currentColor"
        d="M8 1a3 3 0 0 0-3 3v2H4a1 1 0 0 0-1 1v7a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V7a1 1 0 0 0-1-1h-1V4a3 3 0 0 0-3-3zm-2 3V4a2 2 0 1 1 4 0v1H6z"
      />
    </svg>
  );
}

export function PatientEhrPrintEvolutionBlock({ consultation }: Props) {
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
          <LockIcon />
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
    </article>
  );
}
