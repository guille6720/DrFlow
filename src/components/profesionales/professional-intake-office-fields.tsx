import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type {
  ProfessionalIntakeDetail,
  ProfessionalIntakeLocation,
} from "@/components/profesionales/professional-intake-types";

type Props = {
  locations: ProfessionalIntakeLocation[];
  selected?: ProfessionalIntakeDetail | null;
};

export function ProfessionalIntakeOfficeFields({ locations, selected }: Props) {
  return (
    <>
      <Select
        name="location_id"
        label="Sede existente (opcional)"
        placeholder="Crear sede nueva con el domicilio"
        defaultValue={selected?.location_id ?? ""}
        options={locations.map((l) => ({
          value: l.id,
          label: l.address ? `${l.name} — ${l.address}` : l.name,
        }))}
      />
      <Input
        name="officeAddress"
        label="Domicilio del consultorio"
        defaultValue={selected?.office_address ?? ""}
        placeholder="Calle, número, localidad"
      />
      <Input
        name="officePhone"
        label="Teléfono del consultorio"
        type="tel"
        defaultValue={selected?.office_phone ?? ""}
        placeholder="11 4567-8900"
      />
      <Textarea
        name="acceptedInsurances"
        label="Obras sociales / prepagas a atender"
        defaultValue={selected?.accepted_insurances ?? ""}
        placeholder="PAMI, OSDE, Swiss Medical, IOMA…"
        rows={3}
      />
      <Textarea
        name="intakeNotes"
        label="Notas de ingreso / documentación pendiente"
        defaultValue={selected?.intake_notes ?? ""}
        placeholder={
          selected ? undefined : "Ej: pendiente certificado de ética, habilitación colegio…"
        }
        rows={3}
      />
    </>
  );
}
