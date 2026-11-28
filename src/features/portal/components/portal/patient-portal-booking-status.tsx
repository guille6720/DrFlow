"use client";

import { CalendarCheck } from "lucide-react";

import { formatClinicDateTime } from "@/shared/utils/clinic-timezone";

import type { PatientRequestItem } from "@/features/portal/utils/patient-portal-appointments";

const LABELS: Record<string, string> = {
  pending: "Pendiente de confirmación",
  confirmed: "Turno confirmado",
  cancelled: "Turno cancelado",
  attended: "Turno atendido",
  no_show: "Ausencia registrada",
};

export function PatientPortalBookingStatus({ booking, onOpen }: {
  booking?: PatientRequestItem;
  onOpen: () => void;
}) {
  if (!booking) return null;

  return (
    <section className="mb-4 rounded-2xl border border-emerald-200 bg-white p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <CalendarCheck aria-hidden="true" className="mt-1 h-5 w-5 shrink-0 text-emerald-700" />
        <div aria-live="polite">
          <h2 className="text-base font-semibold text-slate-900">{LABELS[booking.status ?? ""] ?? "Solicitud de turno"}</h2>
          {booking.startAt && (
            <p className="mt-1 text-sm text-slate-600">{formatClinicDateTime(booking.startAt, "EEEE d 'de' MMMM · HH:mm 'hs'")}</p>
          )}
          {booking.professionalName && (
            <p className="text-sm text-slate-600">{booking.professionalName}</p>
          )}
        </div>
      </div>
      <button type="button" onClick={onOpen} className="mt-3 rounded-lg px-2 py-2 text-sm font-semibold text-emerald-800 hover:bg-emerald-50">
        Ver mis turnos
      </button>
    </section>
  );
}
