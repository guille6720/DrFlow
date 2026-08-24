import type { ImportExportHistoryRow } from "@/features/integraciones/server/load-import-export-history";

type Props = { rows: ImportExportHistoryRow[]; error?: string };

export function ImportExportHistoryPanel({ rows, error }: Props) {
  if (error) {
    return <p className="text-sm text-amber-800">{error}</p>;
  }

  if (rows.length === 0) {
    return <p className="text-sm text-slate-600">Todavía no hay importaciones ni exportaciones registradas.</p>;
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200">
      <table className="min-w-full text-left text-sm">
        <thead className="bg-slate-50 text-xs font-semibold text-slate-700">
          <tr>
            <th className="px-3 py-2">Fecha</th>
            <th className="px-3 py-2">Usuario</th>
            <th className="px-3 py-2">Qué</th>
            <th className="px-3 py-2">Archivo / formato</th>
            <th className="px-3 py-2">Registros</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((row) => (
            <tr key={row.id}>
              <td className="px-3 py-2 text-slate-700">
                {new Date(row.occurredAt).toLocaleString("es-AR")}
              </td>
              <td className="px-3 py-2 text-slate-700">{row.actorName}</td>
              <td className="px-3 py-2 text-slate-800">{row.what ?? row.action}</td>
              <td className="px-3 py-2 text-slate-600">{row.fileName ?? row.format ?? "—"}</td>
              <td className="px-3 py-2 text-slate-600">{row.recordCount ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
