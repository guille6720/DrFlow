"use client";

import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Calendar, Plus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useMemo } from "react";

import { Header } from "@/core/components/layout/header";
import { hasPermission } from "@/core/permissions/roles";

import { AgendaCreateForm } from "@/features/agenda/components/agenda/agenda-create-form";
import { AgendaToolbar } from "@/features/agenda/components/agenda/agenda-toolbar";
import { AppointmentRow, filterAppointmentsForDay } from "@/features/agenda/components/agenda/appointment-row";
import { CalendarGrid } from "@/features/agenda/components/agenda/calendar-grid";
import { EditAppointmentDialog } from "@/features/agenda/components/agenda/edit-appointment-dialog";
import { MonthOverviewGrid } from "@/features/agenda/components/agenda/month-overview-grid";
import { useAgendaView } from "@/features/agenda/hooks/use-agenda-view";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import type { Appointment, Clinic, Patient, Professional, UserRole } from "@/types/database";

interface AgendaPageProps {
  initialView?: "day" | "week" | "month";
  initialShowForm?: boolean;
  appointments: Appointment[];
  patients: Pick<Patient, "id" | "first_name" | "last_name" | "document_number">[];
  professionals: Professional[];
  locations: { id: string; name: string }[];
  specialties: { id: string; name: string }[];
  clinics: { clinic_id: string; clinic?: Clinic }[];
  clinicId: string | null;
  role: UserRole | null;
  userName?: string;
  defaultDuration: number;
  scheduleBlocks?: { start_at: string; end_at: string; reason: string | null }[];
  bookingSlug?: string | null;
}

export function AgendaView({
  initialView = "week",
  initialShowForm = false,
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
  scheduleBlocks = [],
  bookingSlug,
}: AgendaPageProps) {
  const router = useRouter();
  const agenda = useAgendaView({
    initialView,
    initialShowForm,
    appointments,
    defaultDuration,
  });

  const {
    view,
    filtered,
    currentDate,
    setCurrentDate,
    setView,
    weekDays,
    showForm,
    openNewAppointmentForm,
    handleSlotClick,
    editingAppointment,
    setEditingAppointment,
  } = agenda;

  const canManage = hasPermission(role, "manageAppointments", false);
  const canStartClinical = hasPermission(role, "editClinicalRecords", false);
  const handleEditAppointment = canManage ? setEditingAppointment : undefined;

  const dayAppointments = useMemo(
    () =>
      view === "day" ? filterAppointmentsForDay(filtered, currentDate) : filtered,
    [view, filtered, currentDate]
  );

  const handleDayClick = useCallback(
    (day: Date) => {
      setCurrentDate(day);
      setView("day");
    },
    [setCurrentDate, setView]
  );

  const handleOpenNewAppointment = useCallback(() => {
    openNewAppointmentForm();
  }, [openNewAppointmentForm]);

  const handleCloseEdit = useCallback(() => {
    setEditingAppointment(null);
  }, [setEditingAppointment]);

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

        {showForm ? (
          <AgendaCreateForm
            agenda={agenda}
            patients={patients}
            professionals={professionals}
            locations={locations}
            specialties={specialties}
            appointments={appointments}
            scheduleBlocks={scheduleBlocks}
            defaultDuration={defaultDuration}
          />
        ) : null}

        {filtered.length === 0 && view === "day" ? (
          <EmptyState
            icon={Calendar}
            title="No hay turnos en este período"
            description="Creá un turno o ajustá los filtros para ver más resultados."
            action={
              <Button onClick={handleOpenNewAppointment}>
                <Plus className="h-4 w-4" />
                Nuevo turno
              </Button>
            }
          />
        ) : view === "week" ? (
          <CalendarGrid
            weekDays={weekDays}
            appointments={filtered}
            blocks={scheduleBlocks}
            onSlotClick={handleSlotClick}
          />
        ) : view === "month" ? (
          <MonthOverviewGrid
            monthDate={currentDate}
            appointments={filtered}
            onDayClick={handleDayClick}
          />
        ) : (
          <Card
            title={format(currentDate, "EEEE d 'de' MMMM", { locale: es })}
            className="border-slate-600/80 bg-slate-800/95 [&_h3]:text-slate-100 [&_.font-medium]:text-slate-50"
          >
            {dayAppointments.length === 0 ? (
              <p className="text-sm text-slate-400">Sin turnos este día.</p>
            ) : (
              <ul className="divide-y divide-slate-700/80">
                {dayAppointments.map((appt) => (
                  <AppointmentRow
                    key={appt.id}
                    appointment={appt}
                    showDate
                    canManage={canManage}
                    canStartClinical={canStartClinical}
                    onEdit={handleEditAppointment}
                  />
                ))}
              </ul>
            )}
          </Card>
        )}

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
      </div>
    </>
  );
}
