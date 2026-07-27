import { MapPin } from "lucide-react";

export function DatosNavigationHelp() {
  return (
    <section className="mb-6 rounded-xl border border-blue-200 bg-gradient-to-br from-blue-50 to-white p-4 text-sm text-slate-800 shadow-sm">
      <p className="flex items-center gap-2 font-semibold text-blue-900">
        <MapPin className="h-4 w-4" />
        Cómo llegar a Importar / Exportar
      </p>
      <ol className="mt-2 list-inside list-decimal space-y-1.5 text-slate-700">
        <li>
          En el <strong>menú azul de la izquierda</strong>, tocá{" "}
          <strong>Importar / Exportar</strong> (ícono de flechas arriba/abajo).
        </li>
        <li>
          También podés abrir directo:{" "}
          <code className="rounded bg-white px-1.5 py-0.5 text-blue-800">/datos</code> en la barra
          del navegador (misma pantalla).
        </li>
        <li>
          <strong>Panel izquierdo:</strong> subís archivos (Excel consumers, export teams JSONL / HCE CSV, PDFs).
        </li>
        <li>
          <strong>Panel derecho (esta columna):</strong> checklist de migración y, más abajo, la
          zona roja para vaciar datos.
        </li>
      </ol>
    </section>
  );
}
