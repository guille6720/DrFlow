import { parsePatientChartExtras } from "@/features/pacientes/utils/patient-chart-notes";

import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

type Extras = ReturnType<typeof parsePatientChartExtras>;

export function PatientClinicalProfileDemographics({
  extras,
  familyMap,
}: {
  extras: Extras;
  familyMap: Map<string, string>;
}) {
  return (
    <>
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
          <Input name="chart_family_mother" label="Madre" defaultValue={familyMap.get("Madre")} />
          <Input
            name="chart_family_siblings"
            label="Hermanos"
            defaultValue={familyMap.get("Hermanos")}
          />
        </div>
      </div>
    </>
  );
}
