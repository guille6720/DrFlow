"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import {
  MEDICAL_SPECIALTIES,
  SPECIALTY_OTHER_VALUE,
} from "@/lib/constants/medical-specialties";

export interface DoctorSetupDefaultValues {
  doctorFirstName?: string;
  doctorLastName?: string;
  documentNumber?: string;
  phone?: string;
  specialtySelect?: string;
  specialtyCustom?: string;
  licenseNational?: string;
  licenseProvincial?: string;
}

interface DoctorSetupFieldsProps {
  fieldErrors: Record<string, string>;
  onClearError: (name: string) => void;
  /** En registro incluye email/contraseña arriba; acá solo datos médicos */
  showSectionTitle?: boolean;
  defaultValues?: DoctorSetupDefaultValues;
}

export function DoctorSetupFields({
  fieldErrors,
  onClearError,
  showSectionTitle = true,
  defaultValues,
}: DoctorSetupFieldsProps) {
  const [specialtySelect, setSpecialtySelect] = useState(
    defaultValues?.specialtySelect ?? ""
  );

  return (
    <div className="space-y-4">
      {showSectionTitle && (
        <div className="border-t border-slate-100 pt-4">
          <h2 className="text-sm font-semibold text-slate-900">Datos del médico titular</h2>
          <p className="mt-1 text-xs text-slate-500">
            Aparecen en el link de la app para pacientes y en los mensajes de WhatsApp.
          </p>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <Input
          name="doctorFirstName"
          label="Nombre"
          placeholder="Guillermo"
          required
          defaultValue={defaultValues?.doctorFirstName}
          error={fieldErrors.doctorFirstName}
          onChange={() => onClearError("doctorFirstName")}
        />
        <Input
          name="doctorLastName"
          label="Apellido"
          placeholder="Castro"
          required
          defaultValue={defaultValues?.doctorLastName}
          error={fieldErrors.doctorLastName}
          onChange={() => onClearError("doctorLastName")}
        />
      </div>

      <Input
        name="documentNumber"
        label="DNI"
        placeholder="12345678"
        inputMode="numeric"
        required
        defaultValue={defaultValues?.documentNumber}
        error={fieldErrors.documentNumber}
        onChange={() => onClearError("documentNumber")}
      />

      <Input
        name="phone"
        label="Teléfono para solicitud de turnos y recetas"
        type="tel"
        placeholder="11 1234-5678"
        required
        defaultValue={defaultValues?.phone}
        error={fieldErrors.phone}
        onChange={() => onClearError("phone")}
      />

      <Select
        name="specialtySelect"
        label="Especialidad"
        required
        value={specialtySelect}
        placeholder="Seleccioná especialidad…"
        error={fieldErrors.specialtySelect}
        options={[
          ...MEDICAL_SPECIALTIES.map((s) => ({ value: s, label: s })),
          { value: SPECIALTY_OTHER_VALUE, label: "Otra (escribir manualmente)" },
        ]}
        onChange={(e) => {
          setSpecialtySelect(e.target.value);
          onClearError("specialtySelect");
          onClearError("specialtyCustom");
        }}
      />

      {specialtySelect === SPECIALTY_OTHER_VALUE && (
        <Input
          name="specialtyCustom"
          label="Especialidad (manual)"
          placeholder="Ej: Medicina del deporte"
          required
          defaultValue={defaultValues?.specialtyCustom}
          error={fieldErrors.specialtyCustom}
          onChange={() => onClearError("specialtyCustom")}
        />
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <Input
          name="licenseNational"
          label="Matrícula nacional"
          placeholder="MN 12345"
          required
          defaultValue={defaultValues?.licenseNational}
          error={fieldErrors.licenseNational}
          onChange={() => onClearError("licenseNational")}
        />
        <Input
          name="licenseProvincial"
          label="Matrícula provincial (opcional)"
          placeholder="Si no tenés, repetí la nacional"
          defaultValue={defaultValues?.licenseProvincial}
          error={fieldErrors.licenseProvincial}
          onChange={() => onClearError("licenseProvincial")}
        />
      </div>
    </div>
  );
}
