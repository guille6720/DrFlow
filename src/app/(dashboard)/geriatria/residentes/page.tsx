import Link from "next/link";
import { redirect } from "next/navigation";

import { DashboardPageHeader } from "@/core/components/layout/dashboard-page-header";
import { ProductRequiredError } from "@/core/products/products.server";

import { requireGeriatricsClinic } from "@/features/geriatria/server/geriatrics.server";
import {
  listGeriatricsResidents,
  residentStatusLabel,
} from "@/features/geriatria/server/residents.server";

import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export default async function ResidentesPage() {
  let clinicId: string;
  try {
    ({ clinicId } = await requireGeriatricsClinic());
  } catch (err) {
    if (err instanceof ProductRequiredError) redirect("/sin-productos");
    redirect("/dashboard");
  }

  const residents = await listGeriatricsResidents(clinicId);

  return (
    <div className="space-y-6">
      <DashboardPageHeader
        title="Residentes"
        subtitle="Ingresos geriátricos vinculados a pacientes de la clínica (sin duplicar identidad)."
      />

      <div className="flex flex-wrap items-center gap-3">
        <ButtonLink href="/geriatria/residentes/nuevo">Nuevo residente</ButtonLink>
        <ButtonLink href="/pacientes" variant="outline">
          Ver pacientes
        </ButtonLink>
      </div>

      <Card title="Listado" description={`${residents.length} ficha(s)`}>
        {residents.length === 0 ? (
          <div className="space-y-3 text-sm text-slate-700 dark:text-slate-200">
            <p>Todavía no hay residentes cargados.</p>
            <p>
              Usá <strong>Nuevo residente</strong> y buscá un paciente existente por nombre o DNI.
              Si la persona aún no está en la clínica, creala primero en Pacientes.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-slate-200 text-slate-500 dark:border-slate-700">
                <tr>
                  <th className="px-2 py-2 font-medium">Residente</th>
                  <th className="px-2 py-2 font-medium">Documento</th>
                  <th className="px-2 py-2 font-medium">Estado</th>
                  <th className="px-2 py-2 font-medium">Ingreso</th>
                  <th className="px-2 py-2 font-medium">Cama</th>
                  <th className="px-2 py-2 font-medium"> </th>
                </tr>
              </thead>
              <tbody>
                {residents.map((r) => {
                  const name = r.patient
                    ? `${r.patient.last_name}, ${r.patient.first_name}`
                    : "Paciente no encontrado";
                  return (
                    <tr
                      key={r.id}
                      className="border-b border-slate-100 dark:border-slate-800"
                    >
                      <td className="px-2 py-2 font-medium text-slate-900 dark:text-slate-100">
                        {name}
                        {r.clinical_alerts ? (
                          <span className="mt-0.5 block text-xs text-amber-700 dark:text-amber-300">
                            Alerta
                          </span>
                        ) : null}
                      </td>
                      <td className="px-2 py-2 tabular-nums text-slate-600 dark:text-slate-300">
                        {r.patient?.document_number ?? "—"}
                      </td>
                      <td className="px-2 py-2">
                        <Badge variant={r.status === "activo" ? "info" : "default"}>
                          {residentStatusLabel(r.status)}
                        </Badge>
                      </td>
                      <td className="px-2 py-2 text-slate-600 dark:text-slate-300">
                        {r.admission_date
                          ? new Date(r.admission_date + "T12:00:00").toLocaleDateString("es-AR")
                          : "—"}
                      </td>
                      <td className="px-2 py-2 text-slate-600 dark:text-slate-300">
                        {r.bed_label ?? "Sin asignar"}
                      </td>
                      <td className="px-2 py-2">
                        <Link
                          href={`/geriatria/residentes/${r.id}/resumen`}
                          className="font-medium text-teal-700 hover:underline dark:text-teal-300"
                        >
                          Resumen
                        </Link>
                        {r.patient ? (
                          <>
                            {" · "}
                            <Link
                              href={`/pacientes/${r.patient.id}`}
                              className="font-medium text-teal-700 hover:underline dark:text-teal-300"
                            >
                              Ficha
                            </Link>
                          </>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
