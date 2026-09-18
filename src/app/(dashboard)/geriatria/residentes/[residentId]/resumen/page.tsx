import Link from "next/link";
import { redirect } from "next/navigation";

import { DashboardPageHeader } from "@/core/components/layout/dashboard-page-header";
import { ProductRequiredError } from "@/core/products/products.server";

import {
  loadResidentRecentSummary,
  requireGeriatricsClinic,
} from "@/features/geriatria/server/geriatrics.server";

import { Card } from "@/components/ui/card";

export default async function ResidentSummaryPage({
  params,
  searchParams,
}: {
  params: Promise<{ residentId: string }>;
  searchParams: Promise<{ h?: string }>;
}) {
  let clinicId: string;
  try {
    ({ clinicId } = await requireGeriatricsClinic());
  } catch (err) {
    if (err instanceof ProductRequiredError) redirect("/sin-productos");
    redirect("/dashboard");
  }

  const { residentId } = await params;
  const { h } = await searchParams;
  const hours = h === "48" || h === "72" ? (Number(h) as 48 | 72) : 24;

  let summary: Awaited<ReturnType<typeof loadResidentRecentSummary>>;
  try {
    summary = await loadResidentRecentSummary(clinicId, residentId, hours);
  } catch {
    summary = {
      hours,
      since: new Date().toISOString(),
      evolutions: [],
      nursing: [],
      medications: [],
      incidents: [],
      nutrition: [],
      transfers: [],
    };
  }

  return (
    <div className="space-y-6">
      <DashboardPageHeader
        title="Resumen reciente"
        subtitle={`Ventana determinística de ${hours} h (sin IA).`}
      />
      <div className="flex flex-wrap gap-2 text-sm">
        {[24, 48, 72].map((n) => (
          <Link
            key={n}
            href={`/geriatria/residentes/${residentId}/resumen?h=${n}`}
            className={
              n === hours
                ? "rounded-lg bg-teal-600 px-3 py-1.5 font-medium text-white"
                : "rounded-lg border border-slate-300 px-3 py-1.5 dark:border-slate-600"
            }
          >
            {n} h
          </Link>
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Evoluciones" description={`${summary.evolutions.length} registros`}>
          <CountList
            items={summary.evolutions.map((e) => ({
              id: String(e.id),
              text: `${e.specialty ?? "—"} · ${String(e.recorded_at ?? "")}`,
            }))}
          />
        </Card>
        <Card title="Enfermería" description={`${summary.nursing.length} registros`}>
          <CountList
            items={summary.nursing.map((e) => ({
              id: String(e.id),
              text: `Turno ${e.shift_key ?? "—"} · ${String(e.recorded_at ?? "")}`,
            }))}
          />
        </Card>
        <Card title="Medicación" description={`${summary.medications.length} registros`}>
          <CountList
            items={summary.medications.map((e) => ({
              id: String(e.id),
              text: `${e.status ?? "—"} · ${String(e.scheduled_at ?? e.administered_at ?? "")}`,
            }))}
          />
        </Card>
        <Card title="Incidentes" description={`${summary.incidents.length} registros`}>
          <CountList
            items={summary.incidents.map((e) => ({
              id: String(e.id),
              text: `${e.incident_type ?? "—"} · ${String(e.occurred_at ?? "")}`,
            }))}
          />
        </Card>
        <Card title="Nutrición / hidratación" description={`${summary.nutrition.length} registros`}>
          <CountList
            items={summary.nutrition.map((e) => ({
              id: String(e.id),
              text: `Ingesta ${e.intake_percent ?? "—"}% · H${e.hydration_ml ?? "—"} ml`,
            }))}
          />
        </Card>
        <Card title="Traslados" description={`${summary.transfers.length} registros`}>
          <CountList
            items={summary.transfers.map((e) => ({
              id: String(e.id),
              text: `${e.transfer_type ?? "—"} · ${e.status ?? "—"}`,
            }))}
          />
        </Card>
      </div>
    </div>
  );
}

function CountList({ items }: { items: { id: string; text: string }[] }) {
  if (items.length === 0) {
    return <p className="text-sm text-slate-500">Sin eventos en la ventana.</p>;
  }
  return (
    <ul className="space-y-1 text-sm text-slate-700 dark:text-slate-200">
      {items.slice(0, 8).map((item) => (
        <li key={item.id}>{item.text}</li>
      ))}
      {items.length > 8 ? (
        <li className="text-slate-500">+{items.length - 8} más</li>
      ) : null}
    </ul>
  );
}
