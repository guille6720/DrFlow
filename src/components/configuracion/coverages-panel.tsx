"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { updateClinicCoverages } from "@/lib/actions/coverages";
import {
  STANDARD_COVERAGES,
  normalizeCoverages,
} from "@/lib/constants/coverages";
import { Shield, Plus, X } from "lucide-react";

interface CoveragesPanelProps {
  acceptedCoverages: string[] | null;
  defaultInsurance: string | null;
}

export function CoveragesPanel({
  acceptedCoverages,
  defaultInsurance,
}: CoveragesPanelProps) {
  const router = useRouter();
  const initial = useMemo(
    () => normalizeCoverages(acceptedCoverages ?? []),
    [acceptedCoverages]
  );

  const [selected, setSelected] = useState<string[]>(() =>
    STANDARD_COVERAGES.filter((c) =>
      initial.some((i) => i.toLowerCase() === c.toLowerCase())
    )
  );
  const [custom, setCustom] = useState<string[]>(() =>
    initial.filter(
      (c) => !STANDARD_COVERAGES.some((s) => s.toLowerCase() === c.toLowerCase())
    )
  );
  const [customInput, setCustomInput] = useState("");
  const [defaultValue, setDefaultValue] = useState(
    defaultInsurance ?? initial[0] ?? STANDARD_COVERAGES[0]
  );
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const allSelected = useMemo(
    () => normalizeCoverages([...selected, ...custom]),
    [selected, custom]
  );

  function toggleStandard(name: string) {
    setSelected((prev) =>
      prev.includes(name) ? prev.filter((c) => c !== name) : [...prev, name]
    );
  }

  function addCustom() {
    const name = customInput.trim();
    if (!name) return;
    setCustom((prev) => normalizeCoverages([...prev, name]));
    setCustomInput("");
  }

  function removeCustom(name: string) {
    setCustom((prev) => prev.filter((c) => c !== name));
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setMsg(null);
    setErr(null);

    const fd = new FormData();
    for (const c of allSelected) fd.append("coverages", c);
    fd.set("custom_coverages", "");
    fd.set("default_insurance", defaultValue);

    const result = await updateClinicCoverages(fd);
    setLoading(false);
    if (result.error) setErr(result.error);
    else {
      setMsg(result.message ?? "Coberturas guardadas.");
      router.refresh();
    }
  }

  const defaultOptions = allSelected.map((c) => ({ value: c, label: c }));

  return (
    <Card title="Coberturas que atendés">
      <p className="mb-4 text-sm text-slate-700">
        Marcá las obras sociales / coberturas de tu consultorio. Si no está en la lista,
        agregala abajo. Los pacientes nuevos se eligen desde esta lista.
      </p>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="grid gap-2 sm:grid-cols-2">
          {STANDARD_COVERAGES.map((name) => {
            const checked = selected.some((c) => c.toLowerCase() === name.toLowerCase());
            return (
              <label
                key={name}
                className="drflow-card-light flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 hover:border-blue-200"
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggleStandard(name)}
                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="font-medium text-slate-800">{name}</span>
              </label>
            );
          })}
        </div>

        <div>
          <p className="mb-2 text-sm font-medium text-slate-700">Otra cobertura (manual)</p>
          <div className="flex flex-wrap gap-2">
            <Input
              value={customInput}
              onChange={(e) => setCustomInput(e.target.value)}
              placeholder="Ej: OSECAC, Accord Salud…"
              className="min-w-[200px] flex-1"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addCustom();
                }
              }}
            />
            <Button type="button" variant="outline" onClick={addCustom}>
              <Plus className="h-4 w-4" />
              Agregar
            </Button>
          </div>
          {custom.length > 0 && (
            <ul className="mt-3 flex flex-wrap gap-2">
              {custom.map((name) => (
                <li
                  key={name}
                  className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-sm text-blue-900"
                >
                  {name}
                  <button
                    type="button"
                    onClick={() => removeCustom(name)}
                    className="ml-1 rounded-full p-0.5 hover:bg-blue-100"
                    aria-label={`Quitar ${name}`}
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <Select
          label="Cobertura por defecto (alta de pacientes)"
          value={
            allSelected.some((c) => c === defaultValue)
              ? defaultValue
              : allSelected[0] ?? ""
          }
          onChange={(e) => setDefaultValue(e.target.value)}
          options={
            defaultOptions.length > 0
              ? defaultOptions
              : [{ value: "", label: "Seleccioná al menos una cobertura" }]
          }
        />

        {msg && (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
            {msg}
          </div>
        )}
        {err && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            {err}
          </div>
        )}

        <Button type="submit" loading={loading}>
          <Shield className="h-4 w-4" />
          Guardar coberturas
        </Button>
      </form>
    </Card>
  );
}
