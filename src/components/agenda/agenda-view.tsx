"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Header } from "@/components/layout/header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { getProfessionalDisplayName } from "@/lib/utils/professional";
import { AppointmentRow, filterAppointmentsForDay } from "@/components/agenda/appointment-row";
import { createAppointment } from "@/lib/actions/clinic";
import { hasPermission } from "@/lib/permissions/roles";
import type { Appointment, Clinic, Patient, Professional, UserRole } from "@/types/database";
import { CalendarGrid } from "@/components/agenda/calendar-grid";
import { AppointmentDatetimePicker } from "@/components/agenda/appointment-datetime-picker";
import { Calendar, ChevronLeft, ChevronRight, Plus } from "lucide-react";
import {
  format,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  addWeeks,
  subWeeks,
  addDays,
  subDays,
} from "date-fns";
import { es } from "date-fns/locale";

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
  appointments: initialAppointments,
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
  const [view, setView] = useState<"day" | "week" | "month">(initialView);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [showForm, setShowForm] = useState(initialShowForm);
  const [filterProfessional, setFilterProfessional] = useState("");
  const [filterSpecialty, setFilterSpecialty] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [startAt, setStartAt] = useState("");
  const [formProfessionalId, setFormProfessionalId] = useState("");

  function openNewAppointmentForm(prefill = "") {
    setStartAt(prefill);
    setShowForm(true);
  }

  function handleSlotClick(day: Date, time: string) {
    const [h, m] = time.split(":").map(Number);
    const d = new Date(day);
    d.setHours(h, m, 0, 0);
    const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 16);
    openNewAppointmentForm(local);
  }

  const filtered = initialAppointments.filter((a) => {
    if (filterProfessional && a.professional_id !== filterProfessional) return false;
    if (filterSpecialty && a.specialty_id !== filterSpecialty) return false;
    return true;
  });

  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(currentDate, { weekStartsOn: 1 });
  const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd });

  const canManage = hasPermission(role, "manageAppointments", false);
  const canStartClinical = hasPermission(role, "editClinicalRecords", false);

  const dayAppointments =
    view === "day" ? filterAppointmentsForDay(filtered, currentDate) : filtered;

  async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const formData = new FormData(e.currentTarget);
    const startAt = formData.get("start_at") as string;
    const duration = parseInt(formData.get("duration") as string) || defaultDuration;
    const start = new Date(startAt);
    const end = new Date(start.getTime() + duration * 60000);
    formData.set("end_at", end.toISOString());
    formData.set("status", "pending");

    const result = await createAppointment(formData);
    setLoading(false);
    if (result.error) {
      setError(result.error);
    } else {
      setShowForm(false);
      setStartAt("");
      setFormProfessionalId("");
      router.refresh();
    }
  }

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
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex rounded-lg border border-slate-200 bg-white p-1">
            {(["day", "week", "month"] as const).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setView(v)}
                className={`rounded-md px-3 py-1.5 text-sm font-medium capitalize ${
                  view === v ? "bg-blue-700 text-white" : "text-slate-600 hover:bg-blue-50"
                }`}
              >
                {v === "day" ? "Día" : v === "week" ? "Semana" : "Mes"}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                setCurrentDate(
                  view === "day" ? subDays(currentDate, 1) : subWeeks(currentDate, 1)
                )
              }
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="min-w-[180px] text-center text-sm font-medium text-slate-700">
              {view === "day"
                ? format(currentDate, "d 'de' MMMM yyyy", { locale: es })
                : format(currentDate, "MMMM yyyy", { locale: es })}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                setCurrentDate(
                  view === "day" ? addDays(currentDate, 1) : addWeeks(currentDate, 1)
                )
              }
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          <Select
            options={[{ value: "", label: "Todos los médicos" }, ...professionals.map((p) => ({
              value: p.id,
              label: getProfessionalDisplayName(p),
            }))]}
            value={filterProfessional}
            onChange={(e) => setFilterProfessional(e.target.value)}
            className="w-48"
          />

          <Select
            options={[{ value: "", label: "Todas las especialidades" }, ...specialties.map((s) => ({
              value: s.id,
              label: s.name,
            }))]}
            value={filterSpecialty}
            onChange={(e) => setFilterSpecialty(e.target.value)}
            className="w-48"
          />

          <Button onClick={() => openNewAppointmentForm()} className="ml-auto">
            <Plus className="h-4 w-4" />
            Nuevo turno
          </Button>
        </div>

        {showForm && (
          <Card title="Nuevo turno">
            <form onSubmit={handleCreate} className="grid gap-4 sm:grid-cols-2">
              <Select
                name="patient_id"
                label="Paciente"
                required
                options={patients.map((p) => ({
                  value: p.id,
                  label: `${p.last_name}, ${p.first_name}`,
                }))}
                placeholder="Seleccionar paciente"
              />
              <Select
                name="professional_id"
                label="Profesional"
                required
                value={formProfessionalId}
                onChange={(e) => setFormProfessionalId(e.target.value)}
                options={professionals.map((p) => ({
                  value: p.id,
                  label: getProfessionalDisplayName(p),
                }))}
                placeholder="Seleccionar profesional"
              />
              <Select
                name="location_id"
                label="Sede"
                options={locations.map((l) => ({ value: l.id, label: l.name }))}
                placeholder="Opcional"
              />
              <Select
                name="specialty_id"
                label="Especialidad"
                options={specialties.map((s) => ({ value: s.id, label: s.name }))}
                placeholder="Opcional"
              />
              <AppointmentDatetimePicker
                key={startAt || "new"}
                value={startAt}
                onChange={setStartAt}
                appointments={initialAppointments}
                scheduleBlocks={scheduleBlocks}
                professionalId={formProfessionalId || undefined}
                required
              />
              <Input
                name="duration"
                label="Duración (min)"
                type="number"
                defaultValue={defaultDuration}
                required
              />
              <div className="sm:col-span-2">
                <Input name="notes" label="Notas" />
              </div>
              {error && <p className="text-sm text-red-600 sm:col-span-2">{error}</p>}
              <div className="flex gap-2 sm:col-span-2">
                <Button type="submit" loading={loading}>Guardar turno</Button>
                <Button type="button" variant="outline" onClick={() => {
                setShowForm(false);
                setStartAt("");
                setFormProfessionalId("");
              }}>
                  Cancelar
                </Button>
              </div>
            </form>
          </Card>
        )}

        {filtered.length === 0 ? (
          <EmptyState
            icon={Calendar}
            title="No hay turnos en este período"
            description="Creá un turno o ajustá los filtros para ver más resultados."
            action={
              <Button onClick={() => openNewAppointmentForm()}>
                <Plus className="h-4 w-4" />
                Nuevo turno
              </Button>
            }
          />
        ) : view === "day" ? (
          <Card title={format(currentDate, "EEEE d 'de' MMMM", { locale: es })}>
            <ul className="divide-y divide-slate-100">
              {dayAppointments.map((appt) => (
                <AppointmentRow
                  key={appt.id}
                  appointment={appt}
                  showDate
                  canManage={canManage}
                  canStartClinical={canStartClinical}
                />
              ))}
            </ul>
          </Card>
        ) : view === "week" ? (
          <CalendarGrid
            weekDays={weekDays}
            appointments={filtered}
            blocks={scheduleBlocks}
            onSlotClick={handleSlotClick}
          />
        ) : (
          <Card>
            <ul className="divide-y divide-slate-100">
              {filtered.map((appt) => (
                <AppointmentRow
                  key={appt.id}
                  appointment={appt}
                  showDate
                  canManage={canManage}
                  canStartClinical={canStartClinical}
                />
              ))}
            </ul>
          </Card>
        )}

        {bookingSlug && (
          <p className="text-sm text-slate-500">
            Link público:{" "}
            <Link
              href={`/solicitar-turno/${bookingSlug}`}
              target="_blank"
              className="font-medium text-blue-700 hover:underline"
            >
              /solicitar-turno/{bookingSlug}
            </Link>
          </p>
        )}
      </div>
    </>
  );
}
