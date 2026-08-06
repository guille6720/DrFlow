"use client";

import { AppointmentDatetimePicker } from "@/features/agenda/components/agenda/appointment-datetime-picker";
import type { AgendaViewState } from "@/features/agenda/hooks/use-agenda-view";
import { PatientSearchCombobox } from "@/features/pacientes/components/pacientes/patient-search-combobox";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { getProfessionalDisplayName } from "@/lib/utils/professional";
import type { Appointment, Patient, Professional } from "@/types/database";

type SharedProps = {
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

const patientOptionsMapper = (
  patients: SharedProps["patients"]
): Array<{
  id: string;
  first_name: string;
  last_name: string;
  document_number: string;
}> =>
  patients.map((p) => ({
    id: p.id,
    first_name: p.first_name,
    last_name: p.last_name,
    document_number: p.document_number,
  }));

export function AgendaCreateFormTop({
  agenda,
  patients,
  professionals,
  locations,
  specialties,
}: Pick<SharedProps, "agenda" | "patients" | "professionals" | "locations" | "specialties">) {
  const { formProfessionalId, setFormProfessionalId } = agenda;

  return (
    <Card title="Nuevo turno">
      <div className="grid gap-4 sm:grid-cols-2">
        <PatientSearchCombobox patients={patientOptionsMapper(patients)} required />
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
      </div>
    </Card>
  );
}

export function AgendaCreateFormBottom({
  agenda,
  appointments,
  scheduleBlocks,
  defaultDuration,
}: Pick<
  SharedProps,
  "agenda" | "appointments" | "scheduleBlocks" | "defaultDuration"
>) {
  const { startAt, setStartAt, formProfessionalId, error, loading, closeForm } = agenda;

  return (
    <Card title="Fecha y confirmación">
      <div className="grid gap-4 sm:grid-cols-2">
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
      </div>
    </Card>
  );
}

/** @deprecated Use AgendaCreateFormTop + AgendaCreateFormBottom in a single form wrapper. */
export function AgendaCreateForm(props: SharedProps) {
  const { handleCreate } = props.agenda;

  return (
    <form onSubmit={handleCreate} className="space-y-4">
      <AgendaCreateFormTop {...props} />
      <AgendaCreateFormBottom {...props} />
    </form>
  );
}
