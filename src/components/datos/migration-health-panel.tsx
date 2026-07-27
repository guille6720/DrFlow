import Link from "next/link";
import {
  AlertTriangle,
  CheckCircle2,
  Circle,
  CircleDot,
} from "lucide-react";
import type { MigrationHealthReport, MigrationStepStatus } from "@/lib/utils/migration-health";

function StepIcon({ status }: { status: MigrationStepStatus }) {
  if (status === "done") return <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" />;
  if (status === "partial") return <CircleDot className="h-5 w-5 shrink-0 text-amber-600" />;
  return <Circle className="h-5 w-5 shrink-0 text-slate-400" />;
}

function PatientGapTable({
  title,
  rows,
  total,
  emptyMessage,
}: {
  title: string;
  rows: MigrationHealthReport["pendingPdf"];
  total: number;
  emptyMessage: string;
}) {
  if (total === 0) {
    return (
      <div className="rounded-lg border border-emerald-100 bg-emerald-50/50 px-4 py-3 text-sm text-emerald-900">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-slate-200">
      <div className="border-b border-slate-200 bg-slate-50 px-4 py-2 text-sm font-medium text-slate-800">
        {title}{" "}
        <span className="font-normal text-slate-500">
          ({total}
          {total > rows.length ? ` · mostrando ${rows.length}` : ""})
        </span>
      </div>
      <ul className="max-h-64 divide-y divide-slate-100 overflow-y-auto text-sm">
        {rows.map((p) => (
          <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2">
            <span className="text-slate-800">
              {p.last_name}, {p.first_name}{" "}
              <span className="text-slate-500">DNI {p.document_number}</span>
            </span>
            <Link
              href={`/historias/paciente/${p.id}`}
              className="text-blue-700 hover:underline"
            >
              Ver HCE
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

interface Props {
  report: MigrationHealthReport;
}

export function MigrationHealthPanel({ report }: Props) {
  const { totals, steps, recordsTruncated } = report;

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-900">Migración segura — estado de la clínica</h2>
      <p className="mt-1 text-sm text-slate-600">
        Orden recomendado: consumers → HCE_export.csv → PDFs de historia. Revisá pendientes antes de
        dar por cerrada la migración.
      </p>

      {recordsTruncated && (
        <p className="mt-3 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          Hay más de 25.000 registros clínicos; el conteo de evoluciones puede estar incompleto.
          Contactá soporte si la clínica es muy grande.
        </p>
      )}

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Pacientes activos" value={totals.activePatients} />
        <Stat label="Con ID consumers" value={totals.withConsumerRef} />
        <Stat label="Con resumen HCE" value={totals.withHceSummary} />
        <Stat label="Con evolución importada" value={totals.withEvolutionConsultation} />
      </div>

      {(totals.placeholderDniWithoutConsumer > 0 || totals.duplicateDniGroups > 0) && (
        <div className="mt-4 flex flex-col gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          {totals.placeholderDniWithoutConsumer > 0 && (
            <p>
              <strong>{totals.placeholderDniWithoutConsumer}</strong> paciente(s) con DNI placeholder
              (90xxxxxx) sin ID consumers — importá el Excel de pacientes y reasociá antes del HCE.
            </p>
          )}
          {totals.duplicateDniGroups > 0 && (
            <p>
              <strong>{totals.duplicateDniGroups}</strong> DNI duplicado(s) — unificá fichas para no
              repartir historias.
            </p>
          )}
        </div>
      )}

      <ol className="mt-6 space-y-4">
        {steps.map((step) => (
          <li
            key={step.id}
            className="flex gap-3 rounded-lg border border-slate-100 bg-slate-50/80 px-4 py-3"
          >
            <StepIcon status={step.status} />
            <div className="min-w-0 flex-1">
              <p className="font-medium text-slate-900">{step.title}</p>
              <p className="mt-0.5 text-sm text-slate-600">{step.description}</p>
              <Link href={step.anchor} className="mt-2 inline-block text-sm font-medium text-blue-700 hover:underline">
                Ir al import en el panel izquierdo
                {step.id !== "consumers" ? " (elegí Export HCE o Historias PDF en el desplegable)" : ""}{" "}
                →
              </Link>
            </div>
          </li>
        ))}
      </ol>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <PatientGapTable
          title="Pendientes de PDF / evolución"
          rows={report.pendingPdf}
          total={report.pendingPdfTotal}
          emptyMessage="Ningún paciente con HCE quedó sin evolución ni PDF archivado."
        />
        <PatientGapTable
          title="Falta resumen HCE (reimportar CSV)"
          rows={report.missingHceSummary}
          total={report.missingHceSummaryTotal}
          emptyMessage="Todos los pacientes con registros HCE tienen hce-export-resumen.csv."
        />
      </div>

      {report.duplicateDnis.length > 0 && (
        <div className="mt-6">
          <h3 className="text-sm font-semibold text-slate-900">DNI duplicados</h3>
          <ul className="mt-2 space-y-3">
            {report.duplicateDnis.map((group) => (
              <li
                key={group.document_number}
                className="rounded-lg border border-slate-200 px-4 py-3 text-sm"
              >
                <p className="font-medium text-slate-800">DNI {group.document_number}</p>
                <ul className="mt-1 space-y-1 text-slate-600">
                  {group.patients.map((p) => (
                    <li key={p.id}>
                      <Link href={`/pacientes/${p.id}`} className="text-blue-700 hover:underline">
                        {p.last_name}, {p.first_name}
                      </Link>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="text-xl font-semibold text-slate-900">{value}</p>
    </div>
  );
}
