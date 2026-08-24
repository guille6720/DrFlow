import { format } from "date-fns";
import { es } from "date-fns/locale";

import {
  extractRecordVersion,
  summarizeClinicalRecordChanges,
} from "@/core/compliance/clinical-record-integrity";

import type { HistoriaDetailPageData } from "@/features/historias/server/load-historia-detail-page";

import { Card } from "@/components/ui/card";

type Props = {
  audit: HistoriaDetailPageData["audit"];
};

function snapshotRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

export function HistoriaDetailAuditCard({ audit }: Props) {
  return (
    <Card title="Historial de versiones">
      {audit.length === 0 ? (
        <p className="text-sm text-slate-500">Sin eventos de auditoría.</p>
      ) : (
        <ul className="space-y-2 text-sm">
          {audit.map((a) => {
            const oldValues = snapshotRecord(a.old_values);
            const newValues = snapshotRecord(a.new_values);
            const changedFields = summarizeClinicalRecordChanges(oldValues, newValues);
            const version =
              extractRecordVersion(newValues) ?? extractRecordVersion(oldValues);

            return (
              <li key={a.id} className="rounded-lg drflow-surface-inset p-3">
                <p className="font-medium">
                  {a.what ?? a.action}
                  {version != null ? ` · v${version}` : ""}
                </p>
                <p className="text-slate-500">
                  {a.profiles?.full_name ?? "Usuario"}
                  {" · "}
                  {format(new Date(a.changed_at), "PPp", { locale: es })}
                </p>
                {changedFields.length > 0 ? (
                  <p className="mt-1 text-slate-600">
                    Campos modificados: {changedFields.join(", ")}
                  </p>
                ) : null}
                {a.change_reason ? (
                  <p className="mt-1 text-slate-600">Motivo: {a.change_reason}</p>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
