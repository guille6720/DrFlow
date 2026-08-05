import { ClipboardCheck } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { getActiveClinic, getSession } from "@/core/auth/session";
import { DashboardPageHeader } from "@/core/components/layout/dashboard-page-header";
import { QaChecklistView } from "@/core/components/qa/qa-checklist-view";
import { canAccessRoute } from "@/core/permissions/roles";

import { Button } from "@/components/ui/button";

export default async function QaPage() {
  const user = await getSession();
  const { role, isSuperadmin } = await getActiveClinic();

  if (!canAccessRoute(role, "/qa", isSuperadmin)) {
    redirect("/dashboard");
  }

  return (
    <>
      <DashboardPageHeader
        title="Checklist QA"
        subtitle="Verificación manual del MVP antes de producción"
      />
      <div className="space-y-4 p-4 sm:p-6">
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-blue-100 bg-blue-50/50 px-4 py-3 text-sm text-blue-900">
          <ClipboardCheck className="h-5 w-5 shrink-0" />
          <p className="flex-1">
            Marcá cada ítem al probarlo. Los links abren el módulo directamente.
          </p>
          <Link href="/configuracion">
            <Button type="button" variant="outline" size="sm">
              Configuración
            </Button>
          </Link>
        </div>
        <QaChecklistView userId={user?.id} />
      </div>
    </>
  );
}
