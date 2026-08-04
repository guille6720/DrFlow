"use client";

import { useMemo } from "react";
import { parsePatientChartExtras } from "@/features/pacientes/utils/patient-chart-notes";
import type { Patient } from "@/types/database";
import { PatientClinicalProfileDemographics } from "@/features/pacientes/components/pacientes/patient-clinical-profile-demographics";
import { PatientClinicalProfileVaccines } from "@/features/pacientes/components/pacientes/patient-clinical-profile-vaccines";
import { PatientClinicalProfileLabs } from "@/features/pacientes/components/pacientes/patient-clinical-profile-labs";

interface Props {
  patient?: Patient;
}

export function PatientClinicalProfileFields({ patient }: Props) {
  const extras = useMemo(() => parsePatientChartExtras(patient?.notes), [patient?.notes]);

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
  }, [extras]);

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

      <PatientClinicalProfileDemographics extras={extras} familyMap={familyMap} />
      <PatientClinicalProfileVaccines vaccineMap={vaccineMap} />
      <PatientClinicalProfileLabs labMap={labMap} />
    </div>
  );
}
