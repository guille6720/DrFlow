import { MapPin } from "lucide-react";

export function DatosNavigationHelp() {
  return (
    <section className="drflow-card-light mb-2 rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-800">
      <p className="flex items-center gap-2 font-semibold text-slate-900">
        <MapPin className="h-4 w-4" />
        Cómo llegar
      </p>
      <ol className="mt-2 list-inside list-decimal space-y-1.5 text-slate-700">
        <li>
          Menú <strong>Administración → Importar / Exportar</strong>
        </li>
        <li>
          O <strong>Configuración → Sistema → Importar / Exportar datos</strong>
        </li>
      </ol>
    </section>
  );
}
