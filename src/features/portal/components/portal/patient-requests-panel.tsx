"use client";

import { Bell, LogOut, RefreshCw } from "lucide-react";
import { useState, useTransition } from "react";

import { usePatientRequestsPanel } from "@/features/pacientes/hooks/use-patient-requests-panel";
import { PatientRequestCard } from "@/features/portal/components/portal/patient-request-card";
import { readDemoBookingLink } from "@/features/portal/utils/demo-booking-link";

import { Button } from "@/components/ui/button";
import { restoreDemoPortalBooking } from "@/lib/actions/public-booking";

interface Props {
  slug: string;
  clinicName: string;
  refreshTrigger?: number;
  demoBooking?: boolean;
}

export function PatientRequestsPanel({ slug, clinicName, refreshTrigger = 0, demoBooking = false }: Props) {
  const panel = usePatientRequestsPanel({ slug, refreshTrigger, demoBooking });
  const [linkError, setLinkError] = useState<string | null>(null);
  const [restoring, startRestore] = useTransition();

  function restore(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const receipt = readDemoBookingLink(String(new FormData(form).get("link") ?? ""));
    if (!receipt) {
      setLinkError("Pegá el enlace de seguimiento completo.");
      return;
    }
    setLinkError(null);
    startRestore(async () => {
      try {
        const result = await restoreDemoPortalBooking(slug, receipt);
        if (result.error) setLinkError(result.error);
        else {
          form.reset();
          panel.handleRefresh();
        }
      } catch {
        setLinkError("No pudimos abrir el enlace. Volvé a intentarlo.");
      }
    });
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-emerald-100 bg-emerald-50/50 p-4">
        <div className="flex items-start gap-3">
          <Bell className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
          <div>
            <p className="font-semibold text-slate-900">Mis turnos y solicitudes</p>
            <p className="mt-1 text-sm text-slate-600">
              {demoBooking
                ? <>Acá ves el estado de los turnos de prueba que pediste a {clinicName} desde este navegador.</>
                : <>Acá ves el estado de tus pedidos a {clinicName}. Podés cancelar turnos confirmados o pendientes.</>}
            </p>
            {!demoBooking && <p className="mt-2 text-xs text-slate-500">Acceso protegido al Portal del Paciente.</p>}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={panel.handleRefresh}
          disabled={panel.refreshing}
        >
          <RefreshCw className={`h-4 w-4 ${panel.refreshing ? "animate-spin" : ""}`} />
          Actualizar
        </Button>
        {panel.authenticated ? (
          <Button
            type="button"
            variant="ghost"
            onClick={panel.handleLogout}
            disabled={panel.loggingOut}
          >
            <LogOut className="h-4 w-4" />
            Cerrar sesión
          </Button>
        ) : null}
      </div>

      {panel.loadError && (
        <p className="rounded-xl border border-red-100 bg-red-50 p-3 text-sm text-red-700">
          {panel.loadError}
        </p>
      )}

      {!demoBooking && !panel.authenticated && !panel.loadError ? (
        <p className="rounded-xl border border-dashed border-slate-200 bg-white p-6 text-center text-sm text-slate-500">
          Para ver tus turnos necesitás ingresar desde el enlace seguro enviado por el consultorio.
        </p>
      ) : null}

      {(panel.authenticated || demoBooking) && panel.items.length === 0 && !panel.loadError && !panel.refreshing ? (
        <p className="rounded-xl border border-dashed border-slate-200 bg-white p-6 text-center text-sm text-slate-500">
          No tenés turnos online para mostrar. Podés pedir uno nuevo desde Inicio.
        </p>
      ) : null}

      {panel.items.length > 0 ? (
        <ul className="space-y-3">
          {panel.items.map((request) => (
            <PatientRequestCard key={request.id} request={request} panel={panel} />
          ))}
        </ul>
      ) : null}
      {demoBooking ? (
        <details className="rounded-xl border border-slate-200 bg-white p-4">
          <summary className="cursor-pointer text-sm font-semibold text-slate-800">¿Pediste el turno desde otro navegador?</summary>
          <form onSubmit={restore} className="mt-3 space-y-2">
            <label className="block text-sm text-slate-600">
              Pegá el enlace de seguimiento
              <input name="link" required autoComplete="off" className="mt-1 w-full rounded-lg border border-slate-200 p-2" />
            </label>
            {linkError && <p role="alert" className="text-sm text-red-700">{linkError}</p>}
            <Button type="submit" variant="outline" loading={restoring}>Recuperar turno</Button>
          </form>
        </details>
      ) : null}
    </div>
  );
}
