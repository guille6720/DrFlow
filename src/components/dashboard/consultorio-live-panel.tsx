import Link from "next/link";
import { formatClinicDateTime } from "@/lib/utils/clinic-timezone";
import { format, differenceInMinutes } from "date-fns";
import { es } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Badge, appointmentStatusBadge } from "@/components/ui/badge";
import { Clock, Play, Globe, CalendarDays } from "lucide-react";
import { PatientWhatsAppButton } from "@/components/ui/patient-whatsapp-button";
import { buildPatientContactMessage } from "@/lib/utils/patient-messages";

export type LiveAppointment = {
  id: string;
  start_at: string;
  status: string;
  booking_source?: string | null;
  patients?: { first_name: string; last_name: string; phone?: string | null } | null;
  professionals?: { profiles?: { full_name: string } | null } | null;
};

interface ConsultorioLivePanelProps {
  todayTotal: number;
  todayDone: number;
  next: LiveAppointment | null;
  todayQueue: LiveAppointment[];
}

function formatCountdown(startAt: string): string {
  const mins = differenceInMinutes(new Date(startAt), new Date());
  if (mins <= 0) return "Ahora";
  if (mins < 60) return `En ${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `En ${h}h ${m}m` : `En ${h}h`;
}

/** Panel "Consultorio en vivo": próximo paciente + progreso del día (único vs competencia). */
export function ConsultorioLivePanel({
  todayTotal,
  todayDone,
  next,
  todayQueue,
}: ConsultorioLivePanelProps) {
  const progress = todayTotal > 0 ? Math.round((todayDone / todayTotal) * 100) : 0;
  const patientName = next?.patients
    ? `${next.patients.first_name} ${next.patients.last_name}`
    : null;

  return (
    <section className="overflow-hidden rounded-2xl border border-blue-200/60 bg-gradient-to-br from-blue-950 via-blue-900 to-slate-900 text-white shadow-lg shadow-blue-900/20">
      <div className="grid gap-6 p-5 sm:p-6 lg:grid-cols-[1fr_auto] lg:items-center">
        <div>
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-500/20 px-2.5 py-0.5 text-xs font-medium text-blue-100">
              <span className="h-1.5 w-1.5 animate-pulse-soft rounded-full bg-emerald-400" />
              Consultorio en vivo
            </span>
            <span className="text-xs text-blue-200/80">
              {format(new Date(), "EEEE d MMMM", { locale: es })}
            </span>
          </div>

          {next && patientName ? (
            <>
              <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">{patientName}</h2>
              <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-blue-100/90">
                <Clock className="h-4 w-4" />
                {formatClinicDateTime(next.start_at, "HH:mm")} hs
                <span className="text-blue-300">·</span>
                <span className="font-medium text-amber-200">{formatCountdown(next.start_at)}</span>
                {next.booking_source === "online" && (
                  <Badge variant="info" className="border-blue-400/30 bg-blue-500/20 text-blue-50">
                    <Globe className="mr-1 h-3 w-3" />
                    Web
                  </Badge>
                )}
                <PatientWhatsAppButton
                  phone={next.patients?.phone}
                  message={buildPatientContactMessage(patientName ?? "paciente")}
                  size="icon"
                  className="ml-1"
                />
              </p>
            </>
          ) : (
            <>
              <h2 className="text-2xl font-bold tracking-tight">Sin turnos pendientes hoy</h2>
              <p className="mt-1 text-sm text-blue-100/80">
                Programá turnos o cargá datos demo para probar el flujo completo.
              </p>
            </>
          )}

          <div className="mt-4 max-w-md">
            <div className="mb-1 flex justify-between text-xs text-blue-200/90">
              <span>Progreso del día</span>
              <span>
                {todayDone}/{todayTotal} turnos
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-blue-950/60">
              <div
                className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-blue-300 transition-all duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row lg:flex-col">
          {next ? (
            <Link href={`/agenda?view=day`}>
              <Button
                size="lg"
                className="w-full border-0 bg-white text-blue-900 shadow-md hover:bg-blue-50"
              >
                <Play className="h-4 w-4 fill-blue-900" />
                Ir a agenda del día
              </Button>
            </Link>
          ) : (
            <Link href="/agenda?action=new">
              <Button size="lg" className="w-full border-0 bg-white text-blue-900 hover:bg-blue-50">
                <CalendarDays className="h-4 w-4" />
                Nuevo turno
              </Button>
            </Link>
          )}
          <Link href="/agenda?view=day">
            <Button variant="outline" size="lg" className="w-full border-blue-400/40 text-white hover:bg-blue-800/50">
              Ver cola de hoy ({todayQueue.length})
            </Button>
          </Link>
        </div>
      </div>

      {todayQueue.length > 0 && (
        <div className="border-t border-blue-800/50 bg-blue-950/40 px-5 py-3 sm:px-6">
          <ul className="flex gap-3 overflow-x-auto pb-1 text-sm">
            {todayQueue.slice(0, 6).map((appt) => {
              const status = appointmentStatusBadge[appt.status];
              const name = appt.patients
                ? `${appt.patients.last_name}, ${appt.patients.first_name}`
                : "Paciente";
              const fullName = appt.patients
                ? `${appt.patients.first_name} ${appt.patients.last_name}`
                : "paciente";
              return (
                <li
                  key={appt.id}
                  className="flex shrink-0 items-center gap-2 rounded-lg bg-blue-900/50 px-3 py-1.5"
                >
                  <span className="font-medium text-blue-50">{name}</span>
                  <span className="text-blue-300/80">
                    {formatClinicDateTime(appt.start_at, "HH:mm")}
                  </span>
                  {status && (
                    <span className="text-xs text-blue-200/70">{status.label}</span>
                  )}
                  <PatientWhatsAppButton
                    phone={appt.patients?.phone}
                    message={buildPatientContactMessage(fullName)}
                    size="icon"
                    className="h-7 w-7"
                  />
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </section>
  );
}
