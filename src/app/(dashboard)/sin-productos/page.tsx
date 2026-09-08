import Link from "next/link";

import { DashboardPageHeader } from "@/core/components/layout/dashboard-page-header";

import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export default function SinProductosPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-6 py-8">
      <DashboardPageHeader
        title="Sin productos activos"
        subtitle="Esta institución todavía no tiene Clínica ni Geriatría habilitados."
      />
      <Card title="Qué significa esto" description="Habilitación exclusiva del Superadmin">
        <p className="text-sm text-slate-700 dark:text-slate-200">
          Los administradores y propietarios de la institución no pueden activar productos por sí
          mismos. Pedile al equipo DrFlow (Superadmin) que habilite <strong>Clínica</strong>,{" "}
          <strong>Geriatría</strong>, o ambos.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <ButtonLink href="/configuracion">Ir a configuración</ButtonLink>
          <Link href="/ayuda" className="text-sm font-medium text-teal-700 hover:underline">
            Ayuda
          </Link>
        </div>
      </Card>
    </div>
  );
}
