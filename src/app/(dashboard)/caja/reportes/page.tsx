import Link from "next/link";
import { redirect } from "next/navigation";
import { format, subDays } from "date-fns";
import { es } from "date-fns/locale";
import { Header } from "@/components/layout/header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  getActiveClinic,
  getActiveClinicId,
  getProfile,
  getUserClinics,
} from "@/lib/auth/session";
import { hasPermission } from "@/lib/permissions/roles";
import { createClient } from "@/lib/supabase/server";
import {
  labelForAttentionType,
  labelForChargeKind,
  labelForPaymentMethod,
} from "@/lib/constants/cash-register";
import { loadRevenueSnapshot } from "@/lib/server/load-revenue-snapshot";
import { AdminOpsAnalyticsBridge } from "@/components/admin-ops/admin-ops-analytics-bridge";

export default async function CajaReportesPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const sp = await searchParams;
  const profile = await getProfile();
  const clinics = await getUserClinics();
  const clinicId = await getActiveClinicId();
  const { role, isSuperadmin } = await getActiveClinic();

  if (!hasPermission(role, "manageCashRegister", isSuperadmin) || !clinicId) {
    redirect("/dashboard");
  }

  const from = sp.from ?? format(subDays(new Date(), 30), "yyyy-MM-dd");
  const to = sp.to ?? format(new Date(), "yyyy-MM-dd");

  const supabase = await createClient();
  const [{ data: charges }, analytics] = await Promise.all([
    supabase
    .from("cash_charges")
    .select(
      "id, charged_at, amount, charge_kind, attention_type, payment_method, status, patients(last_name, first_name), professionals(display_name, profiles(full_name))"
    )
    .eq("clinic_id", clinicId)
    .gte("charged_at", `${from}T00:00:00.000Z`)
    .lte("charged_at", `${to}T23:59:59.999Z`)
    .order("charged_at", { ascending: false })
    .limit(500),
    loadRevenueSnapshot(supabase, clinicId),
  ]);

  const collected = (charges ?? []).filter((c) => c.status === "collected");
  const total = collected.reduce((s, c) => s + Number(c.amount), 0);

  return (
    <>
      <Header
        title="Reportes de caja"
        subtitle={`${from} — ${to}`}
        clinics={clinics}
        activeClinicId={clinicId}
        role={role}
        userName={profile?.full_name}
      />
      <div className="p-4 sm:p-6">
        <AdminOpsAnalyticsBridge
          analytics={analytics}
          page="caja_reportes"
          canManageCash
          canViewReports={hasPermission(role, "viewReports", isSuperadmin)}
        />
        <Link href="/caja">
          <Button variant="outline" size="sm" className="mb-4">
            Volver
          </Button>
        </Link>
        <Card title={`Ingresos: $${total.toLocaleString("es-AR")} (${collected.length} cobros)`}>
          <form className="mb-4 flex flex-wrap gap-2">
            <input type="date" name="from" defaultValue={from} className="drflow-ui-input rounded-lg border px-2 py-1 text-sm" />
            <input type="date" name="to" defaultValue={to} className="drflow-ui-input rounded-lg border px-2 py-1 text-sm" />
            <Button type="submit" size="sm">
              Filtrar
            </Button>
          </form>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-slate-500">
                  <th className="py-2">Fecha</th>
                  <th>Paciente</th>
                  <th>Tipo cobro</th>
                  <th>Atención</th>
                  <th>Pago</th>
                  <th className="text-right">Importe</th>
                </tr>
              </thead>
              <tbody>
                {collected.map((c) => {
                  const raw = c.patients;
                  const p = Array.isArray(raw) ? raw[0] : raw;
                  return (
                    <tr key={c.id} className="border-b border-slate-700/30">
                      <td className="py-2">{format(new Date(c.charged_at), "dd/MM/yy HH:mm", { locale: es })}</td>
                      <td>{p ? `${p.last_name}, ${p.first_name}` : "—"}</td>
                      <td>{labelForChargeKind(c.charge_kind)}</td>
                      <td>{labelForAttentionType(c.attention_type)}</td>
                      <td>{labelForPaymentMethod(c.payment_method)}</td>
                      <td className="text-right">${Number(c.amount).toLocaleString("es-AR")}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </>
  );
}
