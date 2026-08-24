import Link from "next/link";

import { DashboardPageHeader } from "@/core/components/layout/dashboard-page-header";
import { SuperadminClinicsTable } from "@/core/components/superadmin/superadmin-clinics-table";
import { listSuperadminClinicCommercialRows } from "@/core/entitlements/superadmin-clinics.server";
import { requireSuperadminPage } from "@/core/entitlements/superadmin-guard.server";

export default async function SuperadminClinicsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireSuperadminPage();
  const params = (await searchParams) ?? {};
  const q = typeof params.q === "string" ? params.q : "";
  const plan = typeof params.plan === "string" ? params.plan : "";
  const status = typeof params.status === "string" ? params.status : "";
  const filter = typeof params.filter === "string" ? params.filter : "";

  const rows = await listSuperadminClinicCommercialRows();
  const filtered = rows.filter((row) => {
    if (plan && row.planKey !== plan) return false;
    if (status && row.status !== status) return false;
    if (filter === "trial" && row.planKey !== "trial") return false;
    if (filter === "legacy" && row.planKey !== "legacy") return false;
    if (filter === "recommend" && !row.shouldRecommendUpgrade) return false;
    if (filter === "near") {
      if (!(row.limitPatients && row.limitPatients > 0)) return false;
      const pct = row.patients / row.limitPatients;
      if (!(pct >= 0.85 && pct < 1)) return false;
    }
    if (filter === "limit") {
      if (!(row.limitPatients && row.limitPatients > 0 && row.patients >= row.limitPatients)) {
        return false;
      }
    }
    if (
      filter === "inactive" &&
      !(row.status === "cancelled" || row.status === "expired" || row.status === "past_due")
    ) {
      return false;
    }
    if (q) {
      const hay = `${row.clinicName} ${row.ownerName ?? ""} ${row.ownerEmail ?? ""}`.toLowerCase();
      if (!hay.includes(q.toLowerCase())) return false;
    }
    return true;
  });

  return (
    <div className="space-y-4">
      <DashboardPageHeader
        title="Clínicas"
        subtitle={`${filtered.length} de ${rows.length} clínicas`}
      />
      <form className="flex flex-wrap gap-2 text-sm">
        <input
          name="q"
          defaultValue={q}
          placeholder="Buscar clínica, dueño o email"
          className="min-w-[220px] flex-1 rounded-md border border-slate-300 px-3 py-2"
        />
        <select name="plan" defaultValue={plan} className="rounded-md border border-slate-300 px-2 py-2">
          <option value="">Todos los planes</option>
          {["trial", "essential", "basic", "pro", "premium", "enterprise", "legacy"].map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
        <select name="status" defaultValue={status} className="rounded-md border border-slate-300 px-2 py-2">
          <option value="">Todos los estados</option>
          {["trialing", "active", "past_due", "cancelled", "expired"].map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <select name="filter" defaultValue={filter} className="rounded-md border border-slate-300 px-2 py-2">
          <option value="">Sin filtro extra</option>
          <option value="recommend">Upgrade recomendado</option>
          <option value="trial">Trial</option>
          <option value="legacy">Legacy</option>
          <option value="near">Cerca del límite</option>
          <option value="limit">Límite alcanzado</option>
          <option value="inactive">Inactiva / suspendida</option>
        </select>
        <button type="submit" className="rounded-md bg-slate-900 px-3 py-2 font-medium text-white">
          Filtrar
        </button>
        <Link href="/superadmin/clinics" className="rounded-md border border-slate-300 px-3 py-2">
          Limpiar
        </Link>
      </form>
      <SuperadminClinicsTable rows={filtered} />
    </div>
  );
}
