import Link from "next/link";

export default function SuperadminClinicNotFound() {
  return (
    <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-900">
      <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-50">Clínica no encontrada</h1>
      <p className="text-sm text-slate-600 dark:text-slate-300">
        No hay una clínica con ese id en el listado comercial de Staging, o el enlace está desactualizado.
      </p>
      <Link href="/superadmin/clinics" className="text-sm font-medium text-teal-700 hover:underline">
        ← Volver a clínicas
      </Link>
    </div>
  );
}
