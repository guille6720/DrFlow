"use client";

import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AppInstallCard } from "@/components/portal/app-install-card";
import { ExternalLink, Settings, Smartphone } from "lucide-react";

interface DashboardMobileAppsPanelProps {
  clinicName?: string | null;
  portalSlug?: string | null;
  showSettingsLink?: boolean;
}

export function DashboardMobileAppsPanel({
  clinicName,
  portalSlug,
  showSettingsLink = false,
}: DashboardMobileAppsPanelProps) {
  return (
    <div id="apps-moviles" className="grid min-w-0 gap-4 xl:grid-cols-2">
      <Card title="DrFlow en tu celular">
        <p className="mb-4 break-words text-sm text-slate-600">
          Instalá la app del consultorio con el logo DrFlow. Ideal para revisar agenda y pacientes
          desde el celular.
        </p>
        <AppInstallCard variant="clinic" compact />
      </Card>

      <Card title="App reducida para pacientes">
        <p className="mb-4 break-words text-sm text-slate-600">
          Compartí la versión liviana con tus pacientes: turnos, recetas y WhatsApp.
        </p>
        {portalSlug ? (
          <div className="min-w-0 space-y-3">
            <Link
              href={`/portal/${portalSlug}`}
              target="_blank"
              className="inline-flex max-w-full items-center gap-2 break-all text-sm font-medium text-blue-700 hover:underline"
            >
              <span className="truncate">/portal/{portalSlug}</span>
              <ExternalLink className="h-4 w-4 shrink-0" />
            </Link>
            <AppInstallCard
              variant="patient"
              slug={portalSlug}
              clinicName={clinicName ?? undefined}
              compact
            />
          </div>
        ) : (
          <div className="min-w-0 space-y-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
            <p className="flex items-start gap-2 font-medium">
              <Smartphone className="mt-0.5 h-4 w-4 shrink-0" />
              <span className="break-words">
                Activá la reserva pública para generar el portal de pacientes.
              </span>
            </p>
            {showSettingsLink && (
              <Link href="/configuracion">
                <Button size="sm" variant="outline">
                  <Settings className="h-4 w-4" />
                  Ir a configuración
                </Button>
              </Link>
            )}
            <AppInstallCard variant="patient" compact />
          </div>
        )}
      </Card>
    </div>
  );
}
