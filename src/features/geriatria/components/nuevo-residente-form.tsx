"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { admitPatientAsResident } from "@/features/geriatria/actions/residents";
import type { FreeBedOption } from "@/features/geriatria/server/residents.server";
import { PatientSearchCombobox } from "@/features/pacientes/components/pacientes/patient-search-combobox";

import { Button, ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

type Props = {
  freeBeds: FreeBedOption[];
  defaultPatientId?: string;
};

export function NuevoResidenteForm({ freeBeds, defaultPatientId }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await admitPatientAsResident(formData);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.push(`/geriatria/residentes/${result.residentId}/resumen`);
      router.refresh();
    });
  }

  return (
    <Card
      title="Ingreso de residente"
      description="Seleccioná un paciente existente de la clínica. No se duplica la identidad: se crea la ficha geriátrica vinculada."
    >
      <form action={onSubmit} className="space-y-4">
        <PatientSearchCombobox
          patients={[]}
          name="patient_id"
          label="Paciente de la clínica"
          required
          searchMode="remote"
          displayMode="detailed"
          defaultPatientId={defaultPatientId}
          createPatientHref={(q) =>
            `/pacientes/nuevo?q=${encodeURIComponent(q)}&return=${encodeURIComponent("/geriatria/residentes/nuevo")}`
          }
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-slate-700 dark:text-slate-200">
              Fecha de ingreso
            </span>
            <input
              type="date"
              name="admission_date"
              defaultValue={new Date().toISOString().slice(0, 10)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900"
            />
          </label>

          <label className="block text-sm">
            <span className="mb-1 block font-medium text-slate-700 dark:text-slate-200">
              Cama (opcional)
            </span>
            <select
              name="bed_id"
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900"
              defaultValue=""
            >
              <option value="">Sin asignar</option>
              {freeBeds.map((bed) => (
                <option key={bed.id} value={bed.id}>
                  {[bed.room_code ?? bed.room_name, bed.label ?? bed.code]
                    .filter(Boolean)
                    .join(" · ")}
                </option>
              ))}
            </select>
            {freeBeds.length === 0 ? (
              <span className="mt-1 block text-xs text-slate-500">
                No hay camas libres. Podés asignar después en Habitaciones.
              </span>
            ) : null}
          </label>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field name="dependency_level" label="Nivel de dependencia" placeholder="Ej. moderada" />
          <Field name="mobility" label="Movilidad" placeholder="Ej. deambula con ayuda" />
          <Field name="diet" label="Dieta" placeholder="Ej. blanda / diabética" />
          <Field name="coverage" label="Cobertura" placeholder="Obra social / particular" />
        </div>

        <label className="block text-sm">
          <span className="mb-1 block font-medium text-slate-700 dark:text-slate-200">
            Alertas clínicas
          </span>
          <textarea
            name="clinical_alerts"
            rows={2}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900"
            placeholder="Caídas, alergias críticas, etc."
          />
        </label>

        <label className="block text-sm">
          <span className="mb-1 block font-medium text-slate-700 dark:text-slate-200">
            Observaciones
          </span>
          <textarea
            name="observations"
            rows={3}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900"
          />
        </label>

        {error ? (
          <p className="text-sm text-red-700 dark:text-red-300" role="alert">
            {error}
          </p>
        ) : null}

        <div className="flex flex-wrap gap-3">
          <Button type="submit" disabled={pending}>
            {pending ? "Guardando…" : "Ingresar residente"}
          </Button>
          <ButtonLink href="/geriatria/residentes" variant="outline">
            Cancelar
          </ButtonLink>
        </div>
      </form>
    </Card>
  );
}

function Field({
  name,
  label,
  placeholder,
}: {
  name: string;
  label: string;
  placeholder?: string;
}) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block font-medium text-slate-700 dark:text-slate-200">{label}</span>
      <input
        type="text"
        name={name}
        placeholder={placeholder}
        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900"
      />
    </label>
  );
}
