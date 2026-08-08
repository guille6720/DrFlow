import Link from "next/link";

import { withClinicalHistoryReturn } from "@/shared/utils/clinical-navigation";

import { PatientEhrTableDateCell } from "@/features/historias/components/historias/patient-ehr-table-date-cell";
import type {
  PatientEhrDiagnosisRow,
  PatientEhrTreatmentRow,
} from "@/features/pacientes/utils/patient-ehr-model";

type Props = {
  patientId: string;
  diagnosisRows: PatientEhrDiagnosisRow[];
  treatmentRows: PatientEhrTreatmentRow[];
  showDiagnostics: boolean;
  showTreatments: boolean;
};

export function PatientEhrClinicalTables({
  patientId,
  diagnosisRows,
  treatmentRows,
  showDiagnostics,
  showTreatments,
}: Props) {
  if (!showDiagnostics && !showTreatments) return null;

  return (
    <div className="mt-4 grid gap-4 xl:grid-cols-2">
      {showDiagnostics ? (
        <section className="drflow-ehr-table-panel overflow-hidden rounded-sm border border-[var(--border)]">
          <h3 className="drflow-ehr-table-title border-b border-[var(--border)] px-3 py-2 text-sm font-bold">
            Diagnósticos
          </h3>
          <div className="overflow-x-auto">
            <table className="drflow-ehr-table w-full min-w-[280px] text-left text-xs">
              <thead>
                <tr>
                  <th className="px-3 py-2 font-semibold">Fecha</th>
                  <th className="px-3 py-2 font-semibold">Nombre</th>
                  <th className="px-3 py-2 font-semibold">Crónico</th>
                </tr>
              </thead>
              <tbody>
                {diagnosisRows.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-3 py-6 text-center drflow-ehr-muted">
                      Sin diagnósticos
                    </td>
                  </tr>
                ) : (
                  diagnosisRows.map((row) => (
                    <tr key={row.id} className="border-t border-[var(--border)]">
                      <td className="px-3 py-2 whitespace-nowrap">
                        <PatientEhrTableDateCell
                          recordId={row.recordId}
                          createdAt={row.recordCreatedAt}
                          dateLabel={row.dateLabel}
                        />
                      </td>
                      <td className="px-3 py-2">
                        <Link
                          href={withClinicalHistoryReturn(`/historias/${row.recordId}`, patientId)}
                          className="drflow-ehr-action-link font-medium hover:underline"
                        >
                          {row.name}
                        </Link>
                      </td>
                      <td className="px-3 py-2">
                        {row.chronic ? (
                          <span className="drflow-ehr-action-link font-medium">Crónico</span>
                        ) : (
                          "—"
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {showTreatments ? (
        <section className="drflow-ehr-table-panel overflow-hidden rounded-sm border border-[var(--border)]">
          <h3 className="drflow-ehr-table-title border-b border-[var(--border)] px-3 py-2 text-sm font-bold">
            Tratamientos
          </h3>
          <div className="overflow-x-auto">
            <table className="drflow-ehr-table w-full min-w-[320px] text-left text-xs">
              <thead>
                <tr>
                  <th className="px-3 py-2 font-semibold">Fecha</th>
                  <th className="px-3 py-2 font-semibold">Producto</th>
                  <th className="px-3 py-2 font-semibold">Dosis</th>
                  <th className="px-3 py-2 font-semibold">Estado</th>
                </tr>
              </thead>
              <tbody>
                {treatmentRows.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-3 py-6 text-center drflow-ehr-muted">
                      Sin tratamientos
                    </td>
                  </tr>
                ) : (
                  treatmentRows.map((row) => (
                    <tr key={row.id} className="border-t border-[var(--border)]">
                      <td className="px-3 py-2 whitespace-nowrap">
                        <PatientEhrTableDateCell
                          recordId={row.recordId}
                          createdAt={row.recordCreatedAt}
                          dateLabel={row.dateLabel}
                        />
                      </td>
                      <td className="px-3 py-2">
                        <Link
                          href={withClinicalHistoryReturn(`/historias/${row.recordId}`, patientId)}
                          className="drflow-ehr-action-link font-medium hover:underline"
                        >
                          {row.product}
                        </Link>
                        {row.notes ? <p className="mt-0.5 drflow-ehr-muted">{row.notes}</p> : null}
                      </td>
                      <td className="px-3 py-2">{row.dose}</td>
                      <td className="px-3 py-2">{row.status}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
    </div>
  );
}
