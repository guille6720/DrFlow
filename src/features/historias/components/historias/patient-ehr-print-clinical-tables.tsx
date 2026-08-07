import {
  formatPrintDiagnosisMetaDate,
  formatPrintFullDate,
  formatPrintTreatmentMetaDate,
  professionalMetaLine,
  splitTreatmentProductLab,
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

function tableDateLabel(dateLabel: string): string {
  return dateLabel.split("-").slice(0, 2).join("-");
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
          <div className="drflow-ehr-print-table-caption">Diagnósticos</div>
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
                    <td className="align-top">{tableDateLabel(row.dateLabel)}</td>
                    <td>
                      <div className="drflow-ehr-print-table-stack">
                        {row.chronic ? (
                          <p className="drflow-ehr-print-table-emphasis drflow-ehr-print-chronic">Crónico</p>
                        ) : null}
                        <p className="drflow-ehr-print-table-muted">
                          {consultation
                            ? formatPrintDiagnosisMetaDate(consultation.created_at)
                            : formatPrintFullDate(new Date().toISOString())}
                        </p>
                        <p className="drflow-ehr-print-table-primary">{row.name}</p>
                        {consultation ? (
                          <p className="drflow-ehr-print-professional-meta">
                            {professionalMetaLine(consultation)}
                          </p>
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
          <div className="drflow-ehr-print-table-caption">Tratamientos</div>
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
                const { product, lab } = splitTreatmentProductLab(row.product);
                const presentationDose =
                  row.dose && row.dose !== "—" && !row.product.includes(row.dose) ? row.dose : "";
                const frequency = row.frequency !== "—" ? row.frequency : "";
                const notes =
                  row.notes !== row.product && row.notes !== "—" ? row.notes : "";

                return (
                  <tr key={row.id} className="drflow-ehr-print-table-stack-row">
                    <td className="align-top">{tableDateLabel(row.dateLabel)}</td>
                    <td>
                      <div className="drflow-ehr-print-table-stack">
                        <p className="drflow-ehr-print-treatment-product-line">
                          <span className="drflow-ehr-print-treatment-product">{product}</span>
                          {lab ? <span className="drflow-ehr-print-treatment-lab">{lab}</span> : null}
                        </p>
                        {presentationDose ? (
                          <p className="drflow-ehr-print-table-muted">{presentationDose}</p>
                        ) : null}
                        {consultation ? (
                          <p className="drflow-ehr-print-professional-meta">
                            {professionalMetaLine(consultation)}
                          </p>
                        ) : null}
                      </div>
                    </td>
                    <td className="align-top" />
                    <td className="align-top">{frequency}</td>
                    <td className="align-top">{notes}</td>
                    <td className="align-top">
                      <div className="drflow-ehr-print-table-stack">
                        <p className="drflow-ehr-print-status-actual">{row.status}</p>
                        <p className="drflow-ehr-print-table-muted">
                          {consultation
                            ? formatPrintTreatmentMetaDate(consultation.created_at)
                            : `${row.dateLabel} · (n/a)`}
                        </p>
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
