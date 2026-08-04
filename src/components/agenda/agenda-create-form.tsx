"use client";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { getProfessionalDisplayName } from "@/lib/utils/professional";
import { AppointmentDatetimePicker } from "@/components/agenda/appointment-datetime-picker";
import { PatientSearchCombobox } from "@/components/pacientes/patient-search-combobox";
import type { Appointment, Patient, Professional } from "@/types/database";
import type { AgendaViewState } from "@/lib/hooks/use-agenda-view";

type Props = {
  agenda: Pick<
    AgendaViewState,
    | "startAt"
    | "setStartAt"
    | "formProfessionalId"
    | "setFormProfessionalId"
    | "error"
    | "loading"
    | "closeForm"
    | "handleCreate"
  >;
  patients: Pick<Patient, "id" | "first_name" | "last_name" | "document_number">[];
  professionals: Professional[];
  locations: { id: string; name: string }[];
  specialties: { id: string; name: string }[];
  appointments: Appointment[];
  scheduleBlocks: { start_at: string; end_at: string; reason: string | null }[];
  defaultDuration: number;
};

export function AgendaCreateForm({
  agenda,
  patients,
  professionals,
  locations,
  specialties,
  appointments,
  scheduleBlocks,
  defaultDuration,
}: Props) {
  const {
    startAt,
    setStartAt,
    formProfessionalId,
    setFormProfessionalId,
    error,
    loading,
    closeForm,
    handleCreate,
  } = agenda;

  return (
    <Card title="Nuevo turno">
      <form onSubmit={handleCreate} className="grid gap-4 sm:grid-cols-2">
        <PatientSearchCombobox
          patients={patients.map((p) => ({
            id: p.id,
            first_name: p.first_name,
            last_name: p.last_name,
            document_number: p.document_number,
          }))}
          required
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
          appointments={appointments}
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
        {error ? <p className="text-sm text-red-600 sm:col-span-2">{error}</p> : null}
        <div className="flex gap-2 sm:col-span-2">
          <Button type="submit" loading={loading}>
            Guardar turno
          </Button>
          <Button type="button" variant="outline" onClick={closeForm}>
            Cancelar
          </Button>
        </div>
      </form>
    </Card>
  );
}
