"use client";

import { useMemo, useState } from "react";

import { stripChartJsonFromNotes } from "@/features/pacientes/utils/patient-chart-notes";

import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  coverageOptionsForClinic,
  insuranceNumberLabel,
  resolveDefaultCoverage,
} from "@/lib/constants/coverages";
import type { Patient } from "@/types/database";

interface PatientFormFieldsProps {
  patient?: Patient;
  defaultInsurance?: string | null;
  acceptedCoverages?: string[] | null;
  prefill?: {
    first_name?: string;
    last_name?: string;
    document_number?: string;
  };
}

export function PatientFormFields({
  patient,
  defaultInsurance,
  acceptedCoverages,
  prefill,
}: PatientFormFieldsProps) {
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
  const usingClinicList = (acceptedCoverages?.length ?? 0) > 0;

  return (
    <>
      <Input
        name="first_name"
        label="Nombre"
        required
        defaultValue={patient?.first_name ?? prefill?.first_name}
      />
      <Input
        name="last_name"
        label="Apellido"
        required
        defaultValue={patient?.last_name ?? prefill?.last_name}
      />
      <Input
        name="document_number"
        label="DNI"
        required
        defaultValue={patient?.document_number ?? prefill?.document_number}
      />
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
        label="Cobertura"
        value={coverage}
        onChange={(e) => setCoverage(e.target.value)}
        options={options.map((c) => ({ value: c, label: c }))}
        placeholder={usingClinicList ? undefined : "Elegí cobertura"}
      />
      <Input
        name="insurance_number"
        label={numberLabel}
        defaultValue={patient?.insurance_number ?? undefined}
        placeholder={coverage.toUpperCase().includes("PAMI") ? "Ej: 12-34567890-0" : "N° de afiliado"}
      />
      {!usingClinicList && (
        <p className="text-xs text-slate-500 sm:col-span-2">
          Tip: en Configuración → Coberturas podés marcar las que atendés para que aparezcan acá.
        </p>
      )}
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
      <Textarea
        name="notes"
        label="Comentarios u observaciones"
        className="sm:col-span-2"
        rows={4}
        placeholder="Ej.: preferencias de contacto, recordatorios internos, datos administrativos"
        defaultValue={stripChartJsonFromNotes(patient?.notes) || undefined}
      />
    </>
  );
}
