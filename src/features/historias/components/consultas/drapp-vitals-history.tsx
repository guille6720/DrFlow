"use client";

type VitalsHistoryItem = {
  id: string;
  created_at: string;
  text: string;
};

type Props = {
  items: VitalsHistoryItem[];
};

export function DrappVitalsHistory({ items }: Props) {
  if (items.length === 0) {
    return (
      <section className="rounded-sm border border-slate-200 bg-white">
        <header className="border-b border-slate-100 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-800">
          Signos vitales
        </header>
        <p className="px-3 py-3 text-xs text-slate-500">Sin registros de signos vitales.</p>
      </section>
    );
  }

  return (
    <section className="rounded-sm border border-slate-200 bg-white">
      <header className="border-b border-slate-100 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-800">
        Signos vitales
      </header>
      <ul className="divide-y divide-slate-100">
        {items.map((item) => {
          const when = new Date(item.created_at).toLocaleString("es-AR", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          });
          return (
            <li key={item.id} className="px-3 py-2 text-xs text-slate-700">
              <p className="font-medium text-slate-500">{when}</p>
              <p className="mt-0.5">{item.text}</p>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
