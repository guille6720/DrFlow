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
          {formatPrintTime(consultation.created_at)} {professionalMetaLine(consultation)}
        </p>
        <div className="drflow-ehr-print-evolution-body whitespace-pre-wrap">{evolutionText}</div>
      </section>

      {diagnoses.length > 0 ? (
        <section className="drflow-ehr-print-section">
          <h3 className="drflow-ehr-print-section-title">Diagnósticos</h3>
          <ul className="drflow-ehr-print-list">
            {diagnoses.map((item) => (
              <li key={item}>{item}</li>
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
                <p className="drflow-ehr-print-treatment-product">{item.product}</p>
                {item.dose ? <p className="drflow-ehr-print-treatment-dose">{item.dose}</p> : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </article>
  );
}
