"use client";

import { format } from "date-fns";
import { es } from "date-fns/locale";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";

import { Header } from "@/core/components/layout/header";
import { hasPermission, type PermissionOverrides } from "@/core/permissions/roles";
import type { AppointmentAgendaRow, ProfessionalAgendaRow } from "@/core/supabase/query-types";

import { AgendaToolbar } from "@/features/agenda/components/agenda/agenda-toolbar";
import { CalendarAppointmentDialog } from "@/features/agenda/components/agenda/calendar-appointment-dialog";
import { CalendarGrid } from "@/features/agenda/components/agenda/calendar-grid";
import { EditAppointmentDialog } from "@/features/agenda/components/agenda/edit-appointment-dialog";
import { MonthOverviewGrid } from "@/features/agenda/components/agenda/month-overview-grid";
import { RescheduleAppointmentDialog } from "@/features/agenda/components/agenda/reschedule-appointment-dialog";
import { useAgendaView } from "@/features/agenda/hooks/use-agenda-view";

import type { Clinic, Patient, UserRole } from "@/types/database";

interface AgendaPageProps {
  appointments: AppointmentAgendaRow[];
  patients: Pick<Patient, "id" | "first_name" | "last_name" | "document_number">[];
  professionals: ProfessionalAgendaRow[];
  locations: { id: string; name: string }[];
  specialties: { id: string; name: string }[];
  clinics: { clinic_id: string; clinic?: Clinic }[];
  clinicId: string | null;
  role: UserRole | null;
  userName?: string;
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
  clinics,
  clinicId,
  role,
  userName,
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
    handleSlotClick,
  } = agenda;

  const canManage = hasPermission(role, "manageAppointments", isSuperadmin, permissionOverrides);
  const canStartClinical = hasPermission(role, "editClinicalRecords", isSuperadmin, permissionOverrides);

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

  const handleCalendarSlotClick = useCallback(
    (day: Date, time: string) => {
      if (!canManage) return;
      handleSlotClick(day, time);
    },
    [canManage, handleSlotClick]
  );

  return (
    <>
      <Header
        title="Agenda médica"
        subtitle="Gestión de turnos y disponibilidad"
        clinics={clinics}
        activeClinicId={clinicId}
        role={role}
        userName={userName}
      />

      <div className="space-y-4 p-4 sm:p-6">
        <AgendaToolbar agenda={agenda} professionals={professionals} specialties={specialties} />

        <div className="grid gap-4 xl:grid-cols-2">
          <section aria-label="Calendario semanal">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-slate-200">
                Semana del {format(weekDays[0], "d MMM", { locale: es })} al{" "}
                {format(weekDays[weekDays.length - 1], "d MMM yyyy", { locale: es })}
              </h2>
              {canManage ? (
                <p className="text-xs text-slate-400">
                  Horario libre → nuevo turno · Turno → gestionar o cancelar
                </p>
              ) : canStartClinical ? (
                <p className="text-xs text-slate-400">Clic en paciente para abrir la consulta</p>
              ) : null}
            </div>
            <CalendarGrid
              weekDays={weekDays}
              appointments={filtered}
              blocks={scheduleBlocks}
              onSlotClick={canManage ? handleCalendarSlotClick : undefined}
              onAppointmentClick={canManage ? handleAppointmentClick : undefined}
              canOpenClinical={canStartClinical}
              canManage={canManage}
            />
          </section>

          <section aria-label="Calendario mensual">
            <div className="mb-2">
              <h2 className="text-sm font-semibold text-slate-200">
                {format(currentDate, "MMMM yyyy", { locale: es })}
              </h2>
              <p className="text-xs text-slate-400">Tocá un día para mover la semana</p>
            </div>
            <MonthOverviewGrid
              monthDate={currentDate}
              appointments={filtered}
              onDayClick={handleDayClick}
            />
          </section>
        </div>

        {bookingSlug ? (
          <p className="text-sm text-slate-400">
            Link público:{" "}
            <Link
              href={`/solicitar-turno/${bookingSlug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-teal-300 hover:underline"
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
    </>
  );
}
