import {
  formatPrintFullDate,
  formatPrintMetaDate,
  professionalMetaLine,
} from "@/features/historias/components/historias/patient-ehr-print-utils";
import type {
  PatientEhrConsultation,
  PatientEhrDiagnosisRow,
  PatientEhrTreatmentRow,
} from "@/features/pacientes/utils/patient-ehr-model";

type Props = {
  diagnosisRows: PatientEhrDiagnosisRow[];
  treatmentRows: PatientEhrTreatmentRow[];
  consultations: PatientEhrConsultation[];
};

function consultationForRecord(
  consultations: PatientEhrConsultation[],
  recordId: string
): PatientEhrConsultation | undefined {
  return consultations.find((item) => item.id === recordId);
}

export function PatientEhrPrintClinicalTables({
  diagnosisRows,
  treatmentRows,
  consultations,
}: Props) {
  if (diagnosisRows.length === 0 && treatmentRows.length === 0) return null;

  return (
    <div className="drflow-ehr-print-tables mt-6 space-y-6">
      {diagnosisRows.length > 0 ? (
        <section className="drflow-ehr-print-table-section">
          <h3 className="drflow-ehr-print-section-title">Diagnósticos</h3>
          <table className="drflow-ehr-print-table w-full">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Nombre</th>
              </tr>
            </thead>
            <tbody>
              {diagnosisRows.map((row) => {
                const consultation = consultationForRecord(consultations, row.recordId);
                return (
                  <tr key={row.id} className="drflow-ehr-print-table-stack-row">
                    <td className="align-top">{row.dateLabel.split("-").slice(0, 2).join("-")}</td>
                    <td>
                      <div className="drflow-ehr-print-table-stack">
                        {row.chronic ? <p className="drflow-ehr-print-table-emphasis">Crónico</p> : null}
                        <p className="drflow-ehr-print-table-muted">
                          {consultation
                            ? formatPrintMetaDate(consultation.created_at)
                            : formatPrintFullDate(new Date().toISOString())}
                        </p>
                        <p className="drflow-ehr-print-table-primary">{row.name}</p>
                        {consultation ? (
                          <p className="drflow-ehr-print-table-muted">{professionalMetaLine(consultation)}</p>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      ) : null}

      {treatmentRows.length > 0 ? (
        <section className="drflow-ehr-print-table-section">
          <h3 className="drflow-ehr-print-section-title">Tratamientos</h3>
          <table className="drflow-ehr-print-table w-full">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Producto</th>
                <th>Dosis</th>
                <th>Frecuencia</th>
                <th>Notas</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {treatmentRows.map((row) => {
                const consultation = consultationForRecord(consultations, row.recordId);
                return (
                  <tr key={row.id} className="drflow-ehr-print-table-stack-row">
                    <td className="align-top">{row.dateLabel.split("-").slice(0, 2).join("-")}</td>
                    <td colSpan={5}>
                      <div className="drflow-ehr-print-table-stack">
                        <div className="drflow-ehr-print-treatment-grid">
                          <span className="drflow-ehr-print-table-primary">{row.product}</span>
                          <span>{row.dose}</span>
                          <span>{row.frequency}</span>
                          <span>{row.notes !== row.product ? row.notes : "—"}</span>
                          <span>{row.status}</span>
                        </div>
                        {row.dose ? <p className="drflow-ehr-print-table-muted">{row.dose}</p> : null}
                        <p className="drflow-ehr-print-table-emphasis">{row.status}</p>
                        <p className="drflow-ehr-print-table-muted">
                          {consultation
                            ? formatPrintMetaDate(consultation.created_at)
                            : `${row.dateLabel} · (n/a)`}
                        </p>
                        {consultation ? (
                          <p className="drflow-ehr-print-table-muted">{professionalMetaLine(consultation)}</p>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      ) : null}
    </div>
  );
}
