"use client";

import { useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import {
  parsePatientChartExtras,
  STANDARD_LAB_NAMES,
  STANDARD_VACCINE_NAMES,
} from "@/lib/utils/patient-chart-notes";
import type { Patient } from "@/types/database";

function vaccineSlug(name: string) {
  return name.toLowerCase().replace(/\s+/g, "_").replace(/ó/g, "o");
}

function labSlug(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]/g, "");
}

interface Props {
  patient?: Patient;
}

export function PatientClinicalProfileFields({ patient }: Props) {
  const extras = useMemo(
    () => parsePatientChartExtras(patient?.notes),
    [patient?.notes]
  );

  const familyMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const f of extras.family_history ?? []) {
      m.set(f.relation, f.conditions);
    }
    return m;
  }, [extras.family_history]);

  const vaccineMap = useMemo(() => {
    const m = new Map<string, { status: string; year?: string }>();
    for (const v of extras.vaccines ?? []) {
      m.set(v.name, { status: v.status, year: v.year });
    }
    return m;
  }, [extras.vaccines]);

  const labMap = useMemo(() => {
    const m = new Map<string, NonNullable<typeof extras.labs>[number]>();
    for (const l of extras.labs ?? []) {
      m.set(l.name, l);
    }
    return m;
  }, [extras.labs]);

  return (
    <div
      id="perfil-clinico"
      className="sm:col-span-2 rounded-xl border border-teal-500/30 bg-teal-950/10 p-4 dark:border-teal-400/25"
    >
      <h3 className="mb-1 text-sm font-semibold text-teal-800 dark:text-teal-200">
        Perfil clínico (ficha rápida)
      </h3>
      <p className="mb-4 text-xs text-slate-600 dark:text-slate-400">
        Completá sexo, hábitos, vacunas y últimos labs. Se guarda con el paciente y alimenta el resumen
        de la ficha.
      </p>

      <div className="grid gap-3 sm:grid-cols-2">
        <Select
          name="chart_sex"
          label="Sexo"
          defaultValue={extras.sex ?? ""}
          options={[
            { value: "", label: "Sin definir" },
            { value: "F", label: "Femenino" },
            { value: "M", label: "Masculino" },
            { value: "X", label: "Otro / no informa" },
          ]}
        />
        <Input
          name="chart_blood_group"
          label="Grupo sanguíneo"
          placeholder="Ej. A+"
          defaultValue={extras.blood_group ?? undefined}
        />
        <Select
          name="chart_smoker"
          label="Tabaquismo"
          defaultValue={extras.smoker ?? ""}
          options={[
            { value: "", label: "Sin registrar" },
            { value: "never", label: "Nunca fumó" },
            { value: "former", label: "Ex fumador" },
            { value: "active", label: "Fumador activo" },
          ]}
        />
        <Input
          name="chart_pack_years"
          label="Índice tabáquico (paquetes-año)"
          inputMode="decimal"
          defaultValue={extras.pack_years != null ? String(extras.pack_years) : undefined}
        />
        <Input
          name="chart_alcohol"
          label="Alcohol"
          placeholder="Ej. ocasional, abstinente"
          defaultValue={extras.alcohol ?? undefined}
        />
        <Input
          name="chart_activity"
          label="Actividad física"
          defaultValue={extras.activity ?? undefined}
        />
        <Input name="chart_diet" label="Alimentación" defaultValue={extras.diet ?? undefined} />
        <Input
          name="chart_occupation"
          label="Ocupación"
          defaultValue={extras.occupation ?? undefined}
        />
        <Select
          name="chart_cv_risk"
          label="Riesgo cardiovascular (clínico)"
          defaultValue={extras.cardiovascular_risk ?? ""}
          options={[
            { value: "", label: "Sin evaluar" },
            { value: "low", label: "Bajo" },
            { value: "moderate", label: "Moderado" },
            { value: "high", label: "Alto" },
          ]}
        />
      </div>

      <fieldset className="mt-4 grid gap-2 sm:grid-cols-2">
        <legend className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
          Alertas clínicas
        </legend>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="chart_anticoagulated" defaultChecked={extras.anticoagulated} />
          Anticoagulado
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="chart_pacemaker" defaultChecked={extras.pacemaker} />
          Marcapasos
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="chart_renal_failure" defaultChecked={extras.renal_failure} />
          Insuficiencia renal
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="chart_heart_failure" defaultChecked={extras.heart_failure} />
          Insuficiencia cardíaca
        </label>
      </fieldset>

      <div className="mt-4">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Vacunas</p>
        <div className="space-y-2">
          {STANDARD_VACCINE_NAMES.map((name) => {
            const slug = vaccineSlug(name);
            const v = vaccineMap.get(name);
            return (
              <div key={name} className="grid grid-cols-[1fr_auto_5rem] items-end gap-2">
                <span className="text-sm">{name}</span>
                <Select
                  name={`chart_vaccine_${slug}`}
                  defaultValue={v?.status ?? "missing"}
                  options={[
                    { value: "missing", label: "—" },
                    { value: "ok", label: "Al día" },
                    { value: "warn", label: "Pendiente" },
                  ]}
                />
                <Input
                  name={`chart_vaccine_${slug}_year`}
                  placeholder="Año"
                  defaultValue={v?.year}
                />
              </div>
            );
          })}
        </div>
      </div>

      <div className="mt-4">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
          Antecedentes familiares
        </p>
        <div className="grid gap-2 sm:grid-cols-1">
          <Input
            name="chart_family_father"
            label="Padre"
            placeholder="Patologías relevantes"
            defaultValue={familyMap.get("Padre")}
          />
          <Input
            name="chart_family_mother"
            label="Madre"
            defaultValue={familyMap.get("Madre")}
          />
          <Input
            name="chart_family_siblings"
            label="Hermanos"
            defaultValue={familyMap.get("Hermanos")}
          />
        </div>
      </div>

      <div className="mt-4">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
          Últimos laboratorios (valores)
        </p>
        <div className="space-y-2">
          {STANDARD_LAB_NAMES.map((name) => {
            const slug = labSlug(name);
            const lab = labMap.get(name);
            return (
              <div key={name} className="grid grid-cols-[6rem_1fr_5rem_6rem] items-end gap-2">
                <span className="text-sm font-medium">{name}</span>
                <Input name={`chart_lab_${slug}`} defaultValue={lab?.value} placeholder="Valor" />
                <Input name={`chart_lab_${slug}_unit`} defaultValue={lab?.unit} placeholder="Unidad" />
                <Select
                  name={`chart_lab_${slug}_status`}
                  defaultValue={lab?.status ?? "unknown"}
                  options={[
                    { value: "unknown", label: "—" },
                    { value: "normal", label: "Normal" },
                    { value: "high", label: "Alto" },
                    { value: "low", label: "Bajo" },
                  ]}
                />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
