import Link from "next/link";

import { DashboardPageHeader } from "@/core/components/layout/dashboard-page-header";

import { Card } from "@/components/ui/card";

type Props = {
  title: string;
  description: string;
  hrefHint?: string;
  hintLabel?: string;
  children?: React.ReactNode;
};

export function GeriatricsSectionPage({
  title,
  description,
  hrefHint,
  hintLabel,
  children,
}: Props) {
  return (
    <div className="space-y-6">
      <DashboardPageHeader title={title} subtitle={description} />
      <Card title={title} description="Módulo Geriatría — staging">
        {children ?? (
          <p className="text-sm text-slate-700 dark:text-slate-200">
            Sección operativa lista. Los datos se cargan desde tablas `geriatrics_*` con RLS por
            clinic_id. Completá el flujo operativo desde este panel a medida que cargues residentes
            y camas.
          </p>
        )}
        {hrefHint ? (
          <p className="mt-3 text-sm">
            <Link href={hrefHint} className="font-medium text-teal-700 hover:underline dark:text-teal-300">
              {hintLabel ?? "Ir"}
            </Link>
          </p>
        ) : null}
      </Card>
    </div>
  );
}
