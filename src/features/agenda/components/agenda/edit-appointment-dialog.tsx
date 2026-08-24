"use client";

import { parseISO } from "date-fns";
import { X } from "lucide-react";
import { useState } from "react";

import type { AppointmentAgendaRow, ProfessionalAgendaRow } from "@/core/supabase/query-types";

import { AppointmentDatetimePicker } from "@/features/agenda/components/agenda/appointment-datetime-picker";
import { PatientSearchCombobox } from "@/features/pacientes/components/pacientes/patient-search-combobox";
import { buildCreatePatientHref } from "@/features/pacientes/utils/create-patient-from-search";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { updateAppointment } from "@/lib/actions/appointments";
import { getProfessionalDisplayName } from "@/lib/utils/professional";
import type { Patient } from "@/types/database";

interface Props {
  appointment: AppointmentAgendaRow;
  patients: Pick<Patient, "id" | "first_name" | "last_name" | "document_number">[];
  professionals: ProfessionalAgendaRow[];
  locations: { id: string; name: string }[];
  specialties: { id: string; name: string }[];
  appointments: AppointmentAgendaRow[];
  scheduleBlocks: { start_at: string; end_at: string; reason: string | null }[];
  defaultDuration: number;
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}

function toLocalDatetimeValue(iso: string) {
  const d = new Date(iso);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

function durationMinutes(startAt: string, endAt: string) {
  return Math.max(
    15,
    Math.round((parseISO(endAt).getTime() - parseISO(startAt).getTime()) / 60000)
  );
}

function appointmentPatientSeed(
  appointment: AppointmentAgendaRow
): { id: string; first_name: string; last_name: string; document_number: string } | null {
  const nested = appointment.patients;
  const patient = Array.isArray(nested) ? nested[0] : nested;
  if (!patient?.first_name || !patient?.last_name) return null;
  return {
    id: appointment.patient_id,
    first_name: patient.first_name,
    last_name: patient.last_name,
    document_number: patient.document_number ?? "",
  };
}

export function EditAppointmentDialog({
  appointment,
  patients: _patients,
  professionals,
  locations,
  specialties,
  appointments,
  scheduleBlocks,
  defaultDuration,
  open,
  onClose,
  onSaved,
}: Props) {
  const [startAt, setStartAt] = useState(() => toLocalDatetimeValue(appointment.start_at));
  const [professionalId, setProfessionalId] = useState(appointment.professional_id);
  const [duration, setDuration] = useState(() =>
    durationMinutes(appointment.start_at, appointment.end_at)
  );
  const [notes, setNotes] = useState(appointment.notes ?? "");
  const [locationId, setLocationId] = useState(appointment.location_id ?? "");
  const [specialtyId, setSpecialtyId] = useState(appointment.specialty_id ?? "");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (!open) return null;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const formData = new FormData(e.currentTarget);
    const start = new Date(startAt);
    const end = new Date(start.getTime() + duration * 60000);
    formData.set("start_at", start.toISOString());
    formData.set("end_at", end.toISOString());

    const result = await updateAppointment(appointment.id, formData);
    setLoading(false);

    if (result.error) {
      setError(result.error);
      return;
    }

    onSaved();
    onClose();
  }

  function handleClose() {
    if (loading) return;
    onClose();
  }

  const otherAppointments = appointments.filter((a) => a.id !== appointment.id);

  const seedPatient = appointmentPatientSeed(appointment);

  return (
    <div className="fixed inset-0 z-[200] flex items-end justify-center p-4 sm:items-center">
      <button
        type="button"
        className="absolute inset-0 bg-slate-900/50"
        aria-label="Cerrar"
        onClick={handleClose}
      />
      <div className="drflow-modal-panel drflow-card-light relative z-10 max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-5 text-slate-900 shadow-xl">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Modificar turno</h2>
            <p className="mt-1 text-sm text-slate-500">
              Cambiá fecha, hora, profesional u otros datos del turno.
            </p>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2">
          <PatientSearchCombobox
            patients={seedPatient ? [seedPatient] : []}
            defaultPatientId={appointment.patient_id}
            searchMode="remote"
            minSearchLength={1}
            searchResultLimit={20}
            displayMode="detailed"
            createPatientHref={(q) => buildCreatePatientHref(q, "/agenda")}
            required
          />
          <Select
            name="professional_id"
            label="Profesional"
            required
            value={professionalId}
            onChange={(e) => setProfessionalId(e.target.value)}
            options={professionals.map((p) => ({
              value: p.id,
              label: getProfessionalDisplayName(p),
            }))}
          />
          <Select
            name="location_id"
            label="Sede"
            value={locationId}
            onChange={(e) => setLocationId(e.target.value)}
            options={locations.map((l) => ({ value: l.id, label: l.name }))}
            placeholder="Opcional"
          />
          <Select
            name="specialty_id"
            label="Especialidad"
            value={specialtyId}
            onChange={(e) => setSpecialtyId(e.target.value)}
            options={specialties.map((s) => ({ value: s.id, label: s.name }))}
            placeholder="Opcional"
          />
          <AppointmentDatetimePicker
            key={`${appointment.id}-${startAt}`}
            value={startAt}
            onChange={setStartAt}
            appointments={otherAppointments}
            scheduleBlocks={scheduleBlocks}
            professionalId={professionalId || undefined}
            required
          />
          <Input
            label="Duración (min)"
            type="number"
            value={duration}
            onChange={(e) => setDuration(parseInt(e.target.value, 10) || defaultDuration)}
            min={15}
            step={5}
            required
          />
          <div className="sm:col-span-2">
            <Input
              name="notes"
              label="Notas"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
          {error && <p className="text-sm text-red-600 sm:col-span-2">{error}</p>}
          <div className="flex gap-2 sm:col-span-2">
            <Button type="submit" loading={loading}>
              Guardar cambios
            </Button>
            <Button type="button" variant="outline" onClick={handleClose} disabled={loading}>
              Cancelar
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
