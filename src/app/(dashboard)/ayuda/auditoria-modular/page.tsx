import { ClipboardList } from "lucide-react";
import Link from "next/link";

import { getSession } from "@/core/auth/session.server";
import { DashboardPageHeader } from "@/core/components/layout/dashboard-page-header";
import { QaModularAuditView } from "@/core/components/qa/qa-modular-audit-view";

import { Button } from "@/components/ui/button";

export default async function AyudaAuditoriaModularPage() {
  const user = await getSession();

  return (
    <>
      <DashboardPageHeader
        title="Auditoría QA modular"
        subtitle="Verificación módulo por módulo — auth, pacientes, recetas, permisos…"
      />
      <div className="space-y-4 p-4 sm:p-6">
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-blue-100 bg-blue-50/50 px-4 py-3 text-sm text-blue-900">
          <ClipboardList className="h-5 w-5 shrink-0" />
          <p className="flex-1">
            Marcá cada ítem al probarlo. El progreso se guarda en este navegador. También disponible
            en{" "}
            <code className="rounded bg-white/80 px-1 py-0.5 text-xs">docs/QA-AUDITORIA-MODULAR.md</code>
          </p>
          <Link href="/ayuda">
            <Button type="button" variant="outline" size="sm">
              Volver a Ayuda
            </Button>
          </Link>
        </div>
        <QaModularAuditView userId={user?.id} />
      </div>
    </>
  );
}
