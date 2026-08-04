"use client";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { updateClinicSettings } from "@/lib/actions/settings";
import type { Clinic } from "@/types/database";

type Props = {
  clinic: Clinic;
  onResult: (action: () => Promise<{ error?: string; success?: boolean; slug?: string }>) => void;
};

export function SettingsClinicSection({ clinic, onResult }: Props) {
  return (
    <Card title="Datos de la clínica">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onResult(() => updateClinicSettings(new FormData(e.currentTarget)));
        }}
        className="grid gap-4 sm:grid-cols-2"
      >
        <Input name="name" label="Nombre" defaultValue={clinic.name} required />
        <Input name="email" label="Email" type="email" defaultValue={clinic.email ?? ""} />
        <Input name="phone" label="Teléfono" defaultValue={clinic.phone ?? ""} />
        <Input name="address" label="Dirección" defaultValue={clinic.address ?? ""} />
        <Input
          name="default_appointment_duration"
          label="Duración turno (min)"
          type="number"
          defaultValue={clinic.default_appointment_duration}
        />
        <label className="flex items-start gap-3 rounded-lg border border-slate-200 bg-slate-50/80 p-3 sm:col-span-2">
          <input
            type="checkbox"
            name="voice_input_enabled"
            defaultChecked={clinic.voice_input_enabled !== false}
            className="mt-0.5 h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
          />
          <span className="text-sm">
            <span className="font-medium text-slate-900">Dictado por voz en historias clínicas</span>
            <span className="mt-0.5 block text-slate-600">
              Muestra el botón &quot;Dictar&quot; en motivo, evolución, diagnóstico e indicaciones.
              Cada médico puede desactivarlo también en Configuración → Apariencia.
            </span>
          </span>
        </label>
        <div className="sm:col-span-2">
          <Button type="submit">Guardar clínica</Button>
        </div>
      </form>
    </Card>
  );
}
