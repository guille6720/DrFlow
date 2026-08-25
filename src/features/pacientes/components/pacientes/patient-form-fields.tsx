"use client";

import { useMemo, useState } from "react";

import { stripChartJsonFromNotes } from "@/features/pacientes/utils/patient-chart-notes";

import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  coverageOptionsForClinic,
  defaultInsurancePlanForProvider,
  insuranceNumberLabel,
  insurancePlanOptionsForProvider,
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
  const planOptions = useMemo(
    () => insurancePlanOptionsForProvider(coverage, patient?.insurance_plan),
    [coverage, patient?.insurance_plan]
  );
  const [plan, setPlan] = useState(
    () => patient?.insurance_plan?.trim() || defaultInsurancePlanForProvider(initialCoverage)
  );
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

      <div className="sm:col-span-2 space-y-3 rounded-xl border border-slate-200 bg-slate-50/70 p-3">
        <div>
          <p className="text-sm font-semibold text-slate-900">
            Identidad para receta electrónica (ReNaPDiS)
          </p>
          <p className="mt-1 text-xs text-slate-600">
            Obligatoria solo para receta electrónica nacional. La ficha local sigue funcionando
            sin estos datos.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Select
            name="document_type"
            label="Tipo de documento"
            defaultValue={patient?.document_type ?? "dni"}
            options={[
              { value: "dni", label: "DNI" },
              { value: "passport", label: "Pasaporte" },
              { value: "cuit", label: "CUIT" },
              { value: "cdi", label: "CDI" },
              { value: "other", label: "Otro" },
            ]}
          />
          <Input
            name="cuil"
            label="CUIL"
            defaultValue={patient?.cuil ?? ""}
            placeholder="XX-XXXXXXXX-X"
          />
          <Select
            name="sex"
            label="Sexo registral"
            defaultValue={patient?.sex ?? ""}
            options={[
              { value: "", label: "Sin especificar" },
              { value: "F", label: "Femenino" },
              { value: "M", label: "Masculino" },
              { value: "X", label: "X / no binario" },
            ]}
          />
          <Select
            name="alt_identifier_type"
            label="ID alternativo (si no hay CUIL)"
            defaultValue={patient?.alt_identifier_type ?? ""}
            options={[
              { value: "", label: "Ninguno" },
              { value: "cuit", label: "CUIT" },
              { value: "cdi", label: "CDI" },
              { value: "passport", label: "Pasaporte" },
              { value: "other", label: "Otro" },
            ]}
          />
          <Input
            name="alt_identifier_value"
            label="Valor ID alternativo"
            className="sm:col-span-2"
            defaultValue={patient?.alt_identifier_value ?? ""}
          />
        </div>
      </div>

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
        onChange={(e) => {
          const nextCoverage = e.target.value;
          setCoverage(nextCoverage);
          setPlan(defaultInsurancePlanForProvider(nextCoverage));
        }}
        options={options.map((c) => ({ value: c, label: c }))}
        placeholder={usingClinicList ? undefined : "Elegí cobertura"}
      />
      <Select
        name="insurance_plan"
        label="Plan"
        value={plan}
        onChange={(e) => setPlan(e.target.value)}
        disabled={!coverage}
        options={[
          { value: "", label: coverage ? "Seleccioná…" : "Elegí cobertura primero" },
          ...planOptions.map((option) => ({ value: option, label: option })),
        ]}
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
