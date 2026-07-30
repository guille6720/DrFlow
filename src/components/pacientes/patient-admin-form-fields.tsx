"use client";

import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import {
  coverageOptionsForClinic,
  insuranceNumberLabel,
  resolveDefaultCoverage,
} from "@/lib/constants/coverages";
import type { Patient } from "@/types/database";

interface Props {
  patient?: Patient;
  defaultInsurance?: string | null;
  acceptedCoverages?: string[] | null;
}

/** Formulario restringido: solo datos administrativos (rol Secretaría). */
export function PatientAdminFormFields({
  patient,
  defaultInsurance,
  acceptedCoverages,
}: Props) {
  const options = useMemo(
    () => coverageOptionsForClinic(acceptedCoverages, patient?.insurance_provider),
    [acceptedCoverages, patient?.insurance_provider]
  );

  const initialCoverage = resolveDefaultCoverage(
    defaultInsurance,
    acceptedCoverages,
    patient?.insurance_provider
  );

  const [coverage, setCoverage] = useState(initialCoverage);
  const numberLabel = insuranceNumberLabel(coverage);

  return (
    <>
      <Input name="first_name" label="Nombre" required defaultValue={patient?.first_name} />
      <Input name="last_name" label="Apellido" required defaultValue={patient?.last_name} />
      <Input name="document_number" label="DNI" required defaultValue={patient?.document_number} />
      <Input
        name="birth_date"
        label="Fecha de nacimiento"
        type="date"
        defaultValue={patient?.birth_date ?? undefined}
      />
      <Input name="phone" label="Teléfono (WhatsApp)" type="tel" defaultValue={patient?.phone ?? undefined} />
      <Input name="email" label="Email (opcional)" type="email" defaultValue={patient?.email ?? undefined} />
      <Input
        name="address"
        label="Domicilio"
        className="sm:col-span-2"
        defaultValue={patient?.address ?? undefined}
      />
      <Select
        name="insurance_provider"
        label="Obra social / cobertura"
        value={coverage}
        onChange={(e) => setCoverage(e.target.value)}
        options={options.map((c) => ({ value: c, label: c }))}
      />
      <Input
        name="insurance_plan"
        label="Plan"
        defaultValue={(patient as { insurance_plan?: string })?.insurance_plan ?? undefined}
        placeholder="Ej. 310, PMO, Plan Joven"
      />
      <Input
        name="insurance_number"
        label={numberLabel}
        defaultValue={patient?.insurance_number ?? undefined}
      />
      <Input
        name="emergency_contact_name"
        label="Contacto de emergencia"
        defaultValue={patient?.emergency_contact_name ?? undefined}
      />
      <Input
        name="emergency_contact_phone"
        label="Tel. emergencia"
        type="tel"
        defaultValue={patient?.emergency_contact_phone ?? undefined}
      />
      <p className="text-xs text-slate-500 sm:col-span-2">
        Como secretaría solo podés editar datos administrativos. La información clínica la carga el
        médico.
      </p>
    </>
  );
}
