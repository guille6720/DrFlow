"use client";

import Link from "next/link";
import type { LastConsultSummary } from "@/features/pacientes/utils/clinical-workspace-alerts";

export function ClinicalWorkspaceLastConsultSection({
  summary,
}: {
  summary: LastConsultSummary | null;
}) {
  if (!summary) {
    return (
      <section aria-labelledby="cw-last-consult-title" className="drflow-clinical-workspace-section">
        <h3 id="cw-last-consult-title" className="drflow-clinical-workspace-section-head">
          Última consulta
        </h3>
        <p className="drflow-patient-chart-muted text-sm">Sin consultas registradas.</p>
      </section>
    );
  }

  const rows = [
    { label: "Motivo", value: summary.chiefComplaint },
    { label: "Evaluación", value: summary.assessment },
    { label: "Plan", value: summary.plan },
    { label: "Diagnósticos", value: summary.diagnoses },
    { label: "Recetas", value: summary.prescriptions },
    { label: "Órdenes", value: summary.orders },
    { label: "Seguimiento", value: summary.followUp },
  ];

  return (
    <section aria-labelledby="cw-last-consult-title" className="drflow-clinical-workspace-section">
      <div className="drflow-clinical-workspace-section-head">
        <div>
          <h3 id="cw-last-consult-title">Última consulta</h3>
          <p className="text-[11px] text-slate-400">
            {summary.dateLabel} · {summary.professionalName}
          </p>
        </div>
        <Link href={`/historias/${summary.id}`} className="drflow-patient-chart-link text-xs">
          Nota completa →
        </Link>
      </div>
      <dl className="drflow-clinical-workspace-last-consult">
        {rows.map(({ label, value }) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd className="line-clamp-2">{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
