"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { Badge, appointmentStatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PatientWhatsAppButton } from "@/components/ui/patient-whatsapp-button";
import { updateAppointmentStatus } from "@/lib/actions/clinic";
import { buildPatientContactMessage } from "@/lib/utils/patient-messages";
import { isOnlineBooking } from "@/lib/utils/appointment";
import { CheckCircle2, Globe } from "lucide-react";

interface AppointmentItem {
  id: string;
  start_at: string;
  status: string;
  booking_source?: string | null;
  notes?: string | null;
  patients?: { first_name: string; last_name: string; phone?: string | null } | null;
  professionals?: { profiles?: { full_name?: string } | null } | null;
}

interface Props {
  appointments: AppointmentItem[];
  canManage: boolean;
}

export function DashboardUpcomingList({ appointments, canManage }: Props) {
  const router = useRouter();
  const [actingId, setActingId] = useState<string | null>(null);

  async function confirmAppointment(id: string) {
    setActingId(id);
    await updateAppointmentStatus(id, "confirmed");
    setActingId(null);
    router.refresh();
  }

  return (
    <ul className="divide-y divide-slate-100">
      {appointments.map((appt) => {
        const statusInfo = appointmentStatusBadge[appt.status as keyof typeof appointmentStatusBadge];
        const patientFullName = appt.patients
          ? `${appt.patients.first_name} ${appt.patients.last_name}`
          : "Paciente";
        const online = isOnlineBooking({
          booking_source: appt.booking_source as "manual" | "online" | null,
          notes: appt.notes ?? null,
        });
        const isPending = appt.status === "pending";

        return (
          <li
            key={appt.id}
            className="flex flex-col gap-3 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-medium text-slate-900">{patientFullName}</p>
                {online && (
                  <Badge variant="info" className="gap-1">
                    <Globe className="h-3 w-3" />
                    Web
                  </Badge>
                )}
              </div>
              <p className="text-sm text-slate-500">
                {format(parseISO(appt.start_at), "PPp", { locale: es })}
                {" · "}
                {appt.professionals?.profiles?.full_name ?? "Profesional"}
              </p>
            </div>
            <div className="flex shrink-0 flex-wrap items-center gap-2">
              {canManage && isPending && (
                <Button
                  type="button"
                  size="sm"
                  loading={actingId === appt.id}
                  onClick={() => confirmAppointment(appt.id)}
                  className="bg-emerald-600 hover:bg-emerald-700"
                  title="Confirmar solicitud — el paciente verá el tilde verde"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  Confirmar
                </Button>
              )}
              {appt.status === "confirmed" && (
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600">
                  <CheckCircle2 className="h-4 w-4" />
                  Confirmado
                </span>
              )}
              <PatientWhatsAppButton
                phone={appt.patients?.phone}
                message={buildPatientContactMessage(
                  patientFullName,
                  appt.professionals?.profiles?.full_name ?? undefined
                )}
                size="icon"
              />
              {statusInfo && !isPending && appt.status !== "confirmed" && (
                <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
              )}
              {isPending && !canManage && (
                <Badge variant="warning">Pendiente</Badge>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
