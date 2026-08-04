import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { STANDARD_VACCINE_NAMES } from "@/features/pacientes/utils/patient-chart-notes";

function vaccineSlug(name: string) {
  return name.toLowerCase().replace(/\s+/g, "_").replace(/ó/g, "o");
}

export function PatientClinicalProfileVaccines({
  vaccineMap,
}: {
  vaccineMap: Map<string, { status: string; year?: string }>;
}) {
  return (
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
  );
}
