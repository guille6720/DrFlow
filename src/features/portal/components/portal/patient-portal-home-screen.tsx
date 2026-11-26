"use client";

import { Smartphone } from "lucide-react";
import Link from "next/link";

import { cn } from "@/shared/utils/cn";

import type { PatientPortalState } from "@/features/pacientes/hooks/use-patient-portal";
import { usePatientRequestsPanel } from "@/features/pacientes/hooks/use-patient-requests-panel";
import { AppInstallCard } from "@/features/portal/components/portal/app-install-card";
import { DemoBookingStatus } from "@/features/portal/components/portal/demo-booking-status";
import { DemoTurnNotifications } from "@/features/portal/components/portal/demo-turn-notifications";
import { PatientPortalCalendar } from "@/features/portal/components/portal/patient-portal-calendar";

type Props = Pick<PatientPortalState, "quickActions" | "setScreen"> & {
  slug: string;
  clinicName: string;
  clinicAddress: string | null;
  clinicPhone: string | null;
  portalReady: boolean;
  demoBooking?: boolean;
  refreshTrigger?: number;
  pushPublicKey?: string;
  setPortalReady: (ready: boolean) => void;
};

export function PatientPortalHomeScreen({
  slug,
  clinicName,
  clinicAddress,
  clinicPhone,
  portalReady,
  setPortalReady,
  quickActions,
  demoBooking = false,
  refreshTrigger = 0,
  pushPublicKey,
  setScreen,
}: Props) {
  const { items } = usePatientRequestsPanel({ slug, refreshTrigger, demoBooking, enabled: demoBooking });
  return (
    <>
      {demoBooking && <DemoBookingStatus booking={items.find((item) => item.type === "turno")} onOpen={() => setScreen("turnos")} />}
      {!portalReady && (
        <>
          <AppInstallCard
            slug={slug}
            clinicName={clinicName}
            portalMode
            patientDescription={demoBooking ? "Agregá la app a la pantalla de inicio para probar los turnos online." : undefined}
            className="mb-4"
            onPortalReady={() => setPortalReady(true)}
          />
          <Link
            href={`/portal/${slug}/instalar`}
            className="mb-4 flex items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 py-3 text-sm font-semibold text-emerald-800"
          >
            <Smartphone className="h-4 w-4" />
            Ver guía para instalar la app
          </Link>
        </>
      )}

      <div className={cn(demoBooking ? "flex flex-1 flex-col gap-4" : "space-y-4")}>
        <div className="grid grid-cols-2 gap-3">
          {quickActions.map((action) => {
            const Icon = action.icon;
            return (
              <button
                key={action.id}
                type="button"
                onClick={() => setScreen(action.id)}
                className={cn(
                  "flex flex-col items-start rounded-2xl bg-gradient-to-br p-4 text-left text-white shadow-md transition active:scale-[0.98]",
                  action.color
                )}
              >
                <Icon className="mb-3 h-8 w-8 opacity-90" />
                <span className="text-base font-bold leading-tight">{action.title}</span>
                <span className="mt-1 text-xs opacity-90">{action.desc}</span>
              </button>
            );
          })}
        </div>

        {demoBooking && <PatientPortalCalendar items={items} />}

        {demoBooking && pushPublicKey && <DemoTurnNotifications slug={slug} publicKey={pushPublicKey} />}

        {clinicAddress ? (
          <p className="text-center text-xs text-slate-500">{clinicAddress}</p>
        ) : null}

        {clinicPhone ? (
          <div className="rounded-xl border border-slate-200 bg-white p-4 text-center">
            <p className="text-sm text-slate-600">Teléfono del consultorio</p>
            <p className="mt-1 font-semibold text-slate-900">{clinicPhone}</p>
          </div>
        ) : null}
      </div>
    </>
  );
}
