import { format } from "date-fns";
import { es } from "date-fns/locale";
import Link from "next/link";

import { auditActionLabel } from "@/core/security/audit-types";

import type { ClinicSensitiveAccessLogRow } from "@/features/configuracion/server/load-clinic-sensitive-access-logs";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

type Props = {
  rows: ClinicSensitiveAccessLogRow[];
  error?: string | null;
};

function accessKindLabel(kind: string | null, tab: string | null): string {
  if (kind === "clinical_record_detail") return "Historia clínica";
  if (kind === "patient_admin_documents") return "Docs administrativos";
  if (kind === "patient_workspace") return tab ? `Ficha paciente (${tab})` : "Ficha paciente";
  return kind ?? "Acceso sensible";
}

export function SensitiveAccessLogPanel({ rows, error }: Props) {
  return (
    <Card
      title="Accesos a datos sensibles"
      description="Consultas de historias clínicas, fichas y exportaciones Habeas Data (últimos eventos)."
    >
      {error ? (
        <p className="text-sm text-red-600">{error}</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-slate-500">Sin accesos registrados todavía.</p>
      ) : (
        <ul className="divide-y divide-slate-100 text-sm">
          {rows.map((row) => (
            <li key={row.id} className="py-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="info">{auditActionLabel(row.action)}</Badge>
                <span className="font-medium text-slate-900">
                  {row.what ?? accessKindLabel(row.accessKind, row.tab)}
                </span>
              </div>
              <p className="mt-1 text-slate-600">
                {row.actorName} · {format(new Date(row.occurredAt), "PPp", { locale: es })}
                {row.ipAddress ? ` · IP ${row.ipAddress}` : null}
              </p>
              {row.patientId ? (
                <p className="mt-0.5 text-xs text-slate-500">
                  Paciente:{" "}
                  <Link
                    href={`/pacientes/${row.patientId}`}
                    className="text-teal-700 hover:underline"
                  >
                    {row.patientName ?? row.patientId.slice(0, 8)}
                  </Link>
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
