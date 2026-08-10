"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";

import { hasPermission, type PermissionOverrides } from "@/core/permissions/roles";
import type { AppointmentAgendaRow, ProfessionalAgendaRow } from "@/core/supabase/query-types";

import { AgendaDateStrip } from "@/features/agenda/components/agenda/agenda-date-strip";
import { AgendaDayList } from "@/features/agenda/components/agenda/agenda-day-list";
import { AgendaSummaryCards } from "@/features/agenda/components/agenda/agenda-summary-cards";
import { AgendaToolbar } from "@/features/agenda/components/agenda/agenda-toolbar";
import { MonthOverviewGrid } from "@/features/agenda/components/agenda/month-overview-grid";
import { useAgendaView } from "@/features/agenda/hooks/use-agenda-view";

import type { Patient, UserRole } from "@/types/database";

const EditAppointmentDialog = dynamic(
  () =>
    import("@/features/agenda/components/agenda/edit-appointment-dialog").then((m) => ({
      default: m.EditAppointmentDialog,
    })),
  { loading: () => null }
);

const RescheduleAppointmentDialog = dynamic(
  () =>
    import("@/features/agenda/components/agenda/reschedule-appointment-dialog").then((m) => ({
      default: m.RescheduleAppointmentDialog,
    })),
  { loading: () => null }
);

const CalendarAppointmentDialog = dynamic(
  () =>
    import("@/features/agenda/components/agenda/calendar-appointment-dialog").then((m) => ({
      default: m.CalendarAppointmentDialog,
    })),
  { loading: () => null }
);

interface AgendaPageProps {
  appointments: AppointmentAgendaRow[];
  patients: Pick<Patient, "id" | "first_name" | "last_name" | "document_number">[];
  professionals: ProfessionalAgendaRow[];
  locations: { id: string; name: string }[];
  specialties: { id: string; name: string }[];
  clinicId: string | null;
  role: UserRole | null;
  defaultDuration: number;
  defaultProfessionalId?: string;
  scheduleBlocks?: { start_at: string; end_at: string; reason: string | null }[];
  bookingSlug?: string | null;
  isSuperadmin?: boolean;
  permissionOverrides?: PermissionOverrides;
}

export function AgendaView({
  appointments,
  patients,
  professionals,
  locations,
  specialties,
  clinicId: _clinicId,
  role,
  defaultDuration,
  defaultProfessionalId,
  scheduleBlocks = [],
  bookingSlug,
  isSuperadmin = false,
  permissionOverrides,
}: AgendaPageProps) {
  const router = useRouter();
  const [reschedulingAppointment, setReschedulingAppointment] =
    useState<AppointmentAgendaRow | null>(null);
  const [selectedAppointment, setSelectedAppointment] =
    useState<AppointmentAgendaRow | null>(null);
  const agenda = useAgendaView({
    appointments,
    defaultProfessionalId,
  });

  const {
    filtered,
    currentDate,
    setCurrentDate,
    weekDays,
    editingAppointment,
    setEditingAppointment,
    openNewAppointmentForm,
  } = agenda;

  const canManage = hasPermission(role, "manageAppointments", isSuperadmin, permissionOverrides);
  const canStartClinical = hasPermission(role, "editClinicalRecords", isSuperadmin, permissionOverrides);
  const selectedDay = weekDays[0];

  const handleCloseReschedule = useCallback(() => {
    setReschedulingAppointment(null);
  }, []);

  const handleCloseAppointmentDialog = useCallback(() => {
    setSelectedAppointment(null);
  }, []);

  const handleAppointmentClick = useCallback((appointment: AppointmentAgendaRow) => {
    setSelectedAppointment(appointment);
  }, []);

  const handleRescheduleFromCalendar = useCallback((appointment: AppointmentAgendaRow) => {
    setReschedulingAppointment(appointment);
  }, []);

  const handleDayClick = useCallback(
    (day: Date) => {
      setCurrentDate(day);
    },
    [setCurrentDate]
  );

  const handleCloseEdit = useCallback(() => {
    setEditingAppointment(null);
  }, [setEditingAppointment]);

  return (
    <div className="drflow-agenda-view space-y-5 p-4 sm:p-6">
      <AgendaToolbar agenda={agenda} professionals={professionals} specialties={specialties} />

      <AgendaDateStrip selectedDay={selectedDay} onSelectDay={setCurrentDate} />

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <AgendaDayList
          day={selectedDay}
          appointments={filtered}
          canManage={canManage}
          canStartClinical={canStartClinical}
          onAppointmentClick={canManage ? handleAppointmentClick : undefined}
          onEmptySlotClick={canManage ? openNewAppointmentForm : undefined}
        />

        <aside aria-label="Calendario mensual">
          <MonthOverviewGrid
            monthDate={currentDate}
            appointments={filtered}
            onDayClick={handleDayClick}
          />
        </aside>
      </div>

      <AgendaSummaryCards appointments={filtered} anchorDay={selectedDay} />

      {canManage ? (
        <p className="text-sm font-medium text-slate-600">
          Tocá un turno para gestionarlo · Usá la franja de fechas para cambiar de día
        </p>
      ) : canStartClinical ? (
        <p className="text-sm font-medium text-slate-600">Tocá un turno para ver detalle o abrir la consulta</p>
      ) : null}

      {bookingSlug ? (
        <p className="text-sm text-slate-500">
          Link público:{" "}
          <Link
            href={`/solicitar-turno/${bookingSlug}`}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-teal-700 hover:underline"
          >
            /solicitar-turno/{bookingSlug}
          </Link>
        </p>
      ) : null}

      {editingAppointment ? (
        <EditAppointmentDialog
          key={editingAppointment.id}
          appointment={editingAppointment}
          patients={patients}
          professionals={professionals}
          locations={locations}
          specialties={specialties}
          appointments={appointments}
          scheduleBlocks={scheduleBlocks}
          defaultDuration={defaultDuration}
          open
          onClose={handleCloseEdit}
          onSaved={() => router.refresh()}
        />
      ) : null}

      {reschedulingAppointment ? (
        <RescheduleAppointmentDialog
          key={reschedulingAppointment.id}
          appointment={reschedulingAppointment}
          appointments={appointments}
          scheduleBlocks={scheduleBlocks}
          defaultDuration={defaultDuration}
          open
          onClose={handleCloseReschedule}
          onSaved={() => router.refresh()}
        />
      ) : null}

      <CalendarAppointmentDialog
        appointment={selectedAppointment}
        open={selectedAppointment !== null}
        onClose={handleCloseAppointmentDialog}
        canManage={canManage}
        canStartClinical={canStartClinical}
        onReschedule={canManage ? handleRescheduleFromCalendar : undefined}
      />
    </div>
  );
}
