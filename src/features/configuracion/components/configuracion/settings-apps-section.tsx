"use client";

import { Copy, ExternalLink } from "lucide-react";
import Link from "next/link";

import { buildPatientAppInstallUrl } from "@/features/pacientes/utils/patient-portal-ready";
import { AppInstallCard } from "@/features/portal/components/portal/app-install-card";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { Clinic } from "@/types/database";

type Props = {
  clinic: Clinic;
  bookingSlug: string | null;
  onMessage: (message: string) => void;
};

export function SettingsAppsSection({ clinic, bookingSlug, onMessage }: Props) {
  const slug = bookingSlug ?? clinic.slug;

  return (
    <>
      <Card title="DrFlow en tu celular (médico)">
        <p className="mb-4 text-sm text-slate-600">
          Agregá DrFlow a la pantalla de inicio de tu celular para acceder al dashboard y la agenda.
        </p>
        <AppInstallCard variant="clinic" />
      </Card>

      <Card title="App pacientes (PWA)">
        <p className="mb-3 text-sm text-slate-600">
          Compartí la app de turnos y recetas desde la ficha de cada paciente en{" "}
          <Link href="/pacientes" className="font-medium text-blue-700 hover:underline">
            Pacientes
          </Link>
          . El sistema registra el envío para no repetir con el mismo paciente.
        </p>
        {slug ? (
          <div className="space-y-4">
            <Link
              href={`/portal/${slug}/instalar`}
              target="_blank"
              className="inline-flex items-center gap-2 text-sm font-medium text-blue-700 hover:underline"
            >
              /portal/{slug}/instalar
              <ExternalLink className="h-4 w-4" />
            </Link>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => {
                const url = buildPatientAppInstallUrl(window.location.origin, slug);
                navigator.clipboard.writeText(url);
                onMessage(`Link de instalación copiado: ${url}`);
              }}
            >
              <Copy className="h-3.5 w-3.5" />
              Copiar link de instalación
            </Button>
            <AppInstallCard variant="patient" slug={slug} clinicName={clinic.name} />
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-slate-500">Activá la reserva pública para generar el portal.</p>
            <AppInstallCard variant="patient" />
          </div>
        )}
      </Card>
    </>
  );
}
