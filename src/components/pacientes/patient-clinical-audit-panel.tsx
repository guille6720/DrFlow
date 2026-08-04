"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Shield } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { loadPatientAuditTrail } from "@/lib/server/load-patient-audit-trail";
import {
  auditActionLabel,
  auditEntityLabel,
  type PatientAuditEvent,
} from "@/lib/security/audit-types";
import { auditModuleLabel } from "@/lib/security/audit-log";

type Props = {
  patientId: string;
};

function AuditDiffSummary({ event }: { event: PatientAuditEvent }) {
  const keys = new Set([
    ...Object.keys(event.oldValues ?? {}),
    ...Object.keys(event.newValues ?? {}),
  ]);
  const changed = [...keys].filter((k) => {
    const o = JSON.stringify(event.oldValues?.[k] ?? null);
    const n = JSON.stringify(event.newValues?.[k] ?? null);
    return o !== n;
  });

  if (changed.length === 0) return null;

  return (
    <ul className="mt-2 space-y-0.5 text-xs text-slate-600">
      {changed.slice(0, 6).map((key) => (
        <li key={key}>
          <span className="font-medium">{key}</span>:{" "}
          {event.oldValues?.[key] != null ? String(event.oldValues[key]).slice(0, 80) : "—"} →{" "}
          {event.newValues?.[key] != null ? String(event.newValues[key]).slice(0, 80) : "—"}
        </li>
      ))}
      {changed.length > 6 ? (
        <li className="text-slate-400">+{changed.length - 6} campo(s) más</li>
      ) : null}
    </ul>
  );
}

export function PatientClinicalAuditPanel({ patientId }: Props) {
  const [events, setEvents] = useState<PatientAuditEvent[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    loadPatientAuditTrail(patientId).then((result) => {
      if (cancelled) return;
      if (result.error) setError(result.error);
      else setEvents(result.data ?? []);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [patientId]);

  return (
    <Card title="Auditoría clínica">
      <div className="mb-4 flex items-start gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
        <Shield className="mt-0.5 h-4 w-4 shrink-0 text-teal-700" />
        <p>
          Registro inmutable: quién, qué, cuándo y desde dónde. Los eventos no pueden eliminarse ni
          modificarse.
        </p>
      </div>

      {loading ? (
        <p className="text-sm text-slate-500">Cargando auditoría…</p>
      ) : error ? (
        <p className="text-sm text-red-600">{error}</p>
      ) : events.length === 0 ? (
        <p className="text-sm text-slate-500">Sin eventos de auditoría para este paciente.</p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {events.map((event) => (
            <li key={event.id} className="py-3 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="info">{auditActionLabel(event.action)}</Badge>
                {event.module ? (
                  <Badge variant="default">{auditModuleLabel(event.module)}</Badge>
                ) : null}
                <span className="font-medium">
                  {event.what ?? auditEntityLabel(event.entityType)}
                </span>
                {event.clinicalRecordId ? (
                  <Link
                    href={`/historias/${event.clinicalRecordId}`}
                    className="text-xs text-teal-700 hover:underline"
                  >
                    Ver consulta
                  </Link>
                ) : null}
              </div>
              <p className="mt-1 text-slate-600">
                {event.actorName} · {format(new Date(event.occurredAt), "PPp", { locale: es })}
              </p>
              {(event.ipAddress || event.userAgent) && (
                <p className="text-xs text-slate-400">
                  {event.ipAddress ? `IP ${event.ipAddress}` : null}
                  {event.ipAddress && event.userAgent ? " · " : null}
                  {event.userAgent ? event.userAgent.slice(0, 60) : null}
                </p>
              )}
              <AuditDiffSummary event={event} />
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
