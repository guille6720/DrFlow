import { STANDARD_LAB_NAMES } from "@/features/pacientes/utils/patient-chart-notes";
import { parsePatientChartExtras } from "@/features/pacientes/utils/patient-chart-notes";

import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

type LabEntry = NonNullable<ReturnType<typeof parsePatientChartExtras>["labs"]>[number];

function labSlug(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function PatientClinicalProfileLabs({ labMap }: { labMap: Map<string, LabEntry> }) {
  return (
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
  );
}
