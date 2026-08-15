import { format, subDays } from "date-fns";
import { es } from "date-fns/locale";
import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { getDashboardPageContext } from "@/core/auth/dashboard-page";
import { Header } from "@/core/components/layout/header";
import { hasPermission } from "@/core/permissions/roles";
import { parsePageParam } from "@/core/supabase/pagination";
import { createClient } from "@/core/supabase/server";

import {
  buildCajaReportesUrl,
  loadCajaReportesPageData,
} from "@/features/facturacion/server/load-caja-reportes-page";
import { AdminOpsAnalyticsBridge } from "@/features/ia/components/admin-ops/admin-ops-analytics-bridge";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ListPagination, ListPaginationLabel } from "@/components/ui/list-pagination";
import {
  labelForAttentionType,
  labelForChargeKind,
  labelForPaymentMethod,
} from "@/lib/constants/cash-register";
import { loadRevenueSnapshot } from "@/lib/server/load-revenue-snapshot";

export default async function CajaReportesPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; page?: string }>;
}) {
  const sp = await searchParams;
  const { profile, clinics, clinicId, role, isSuperadmin } = await getDashboardPageContext();

  if (!hasPermission(role, "manageCashRegister", isSuperadmin) || !clinicId) {
    redirect("/dashboard");
  }

  const from = sp.from ?? format(subDays(new Date(), 30), "yyyy-MM-dd");
  const to = sp.to ?? format(new Date(), "yyyy-MM-dd");
  const page = parsePageParam(sp.page);

  const supabase = await createClient();
  const [reportData, analytics] = await Promise.all([
    loadCajaReportesPageData(supabase, clinicId, from, to, page),
    loadRevenueSnapshot(supabase, clinicId),
  ]);

  const { charges, pageMeta, periodTotal, periodCount } = reportData;
  const { page: currentPage, totalPages, total } = pageMeta;

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
        <Card
          title={`Ingresos del período: $${periodTotal.toLocaleString("es-AR")} (${periodCount} cobros)`}
        >
          <form className="mb-4 flex flex-wrap gap-2">
            <input type="date" name="from" defaultValue={from} className="drflow-ui-input rounded-lg border px-2 py-1 text-sm" />
            <input type="date" name="to" defaultValue={to} className="drflow-ui-input rounded-lg border px-2 py-1 text-sm" />
            <Button type="submit" size="sm">
              Filtrar
            </Button>
          </form>
          <p className="mb-3 text-sm text-slate-500">
            Mostrando {charges.length} de {total} cobros en esta página
          </p>
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
                {charges.map((c) => {
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
          {(totalPages > 1 || total > 0) && (
            <ListPagination className="mt-4">
              {currentPage > 1 && (
                <Link href={buildCajaReportesUrl(from, to, currentPage - 1)}>
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-slate-500 bg-slate-700/80 text-slate-100 hover:bg-slate-600"
                  >
                    <ChevronLeft className="h-4 w-4" /> Anterior
                  </Button>
                </Link>
              )}
              <ListPaginationLabel
                current={currentPage}
                totalPages={totalPages}
                suffix={`${total} cobros`}
              />
              {currentPage < totalPages && (
                <Link href={buildCajaReportesUrl(from, to, currentPage + 1)}>
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-slate-500 bg-slate-700/80 text-slate-100 hover:bg-slate-600"
                  >
                    Siguiente <ChevronRight className="h-4 w-4" />
                  </Button>
                </Link>
              )}
            </ListPagination>
          )}
        </Card>
      </div>
    </>
  );
}
