"use client";

import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { PAMI_INSURANCE } from "@/lib/constants/pami-cabecera";
import type { Patient } from "@/types/database";

interface PatientFormFieldsProps {
  patient?: Patient;
  defaultInsurance?: string | null;
}

export function PatientFormFields({ patient, defaultInsurance }: PatientFormFieldsProps) {
  const insuranceDefault =
    patient?.insurance_provider ?? defaultInsurance ?? PAMI_INSURANCE;

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
      <Input
        name="insurance_provider"
        label="Cobertura"
        defaultValue={insuranceDefault}
        placeholder="PAMI"
      />
      <Input
        name="insurance_number"
        label="N° beneficio PAMI"
        defaultValue={patient?.insurance_number ?? undefined}
        placeholder="Ej: 12-34567890-0"
      />
      <Input
        name="emergency_contact_name"
        label="Familiar / cuidador"
        defaultValue={patient?.emergency_contact_name ?? undefined}
      />
      <Input
        name="emergency_contact_phone"
        label="Tel. familiar"
        type="tel"
        defaultValue={patient?.emergency_contact_phone ?? undefined}
      />
      <Textarea
        name="medical_history"
        label="Antecedentes (HTA, DM, EPOC…)"
        className="sm:col-span-2"
        defaultValue={patient?.medical_history ?? undefined}
      />
      <Textarea
        name="allergies"
        label="Alergias"
        className="sm:col-span-2"
        defaultValue={patient?.allergies ?? undefined}
      />
      <Textarea
        name="regular_medication"
        label="Medicación habitual"
        className="sm:col-span-2"
        defaultValue={patient?.regular_medication ?? undefined}
      />
    </>
  );
}
