import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Card } from "@/components/ui/card";
import type { HistoriaDetailPageData } from "@/lib/server/load-historia-detail-page";

type Props = {
  audit: HistoriaDetailPageData["audit"];
};

export function HistoriaDetailAuditCard({ audit }: Props) {
  return (
    <Card title="Auditoría">
      {audit.length === 0 ? (
        <p className="text-sm text-slate-500">Sin eventos de auditoría.</p>
      ) : (
        <ul className="space-y-2 text-sm">
          {audit.map((a) => (
            <li key={a.id} className="rounded-lg drflow-surface-inset p-3">
              <p className="font-medium capitalize">{a.action}</p>
              <p className="text-slate-500">
                {a.profiles?.full_name ?? "Usuario"}
                {" · "}
                {format(new Date(a.changed_at), "PPp", { locale: es })}
              </p>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
