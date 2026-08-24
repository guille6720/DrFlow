"use client";

import { Calculator } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { savePatientClinicalIndicators } from "@/features/pacientes/actions/patient-chart-indicators";
import type { PatientChartExtras } from "@/features/pacientes/utils/patient-chart-model-types";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import {
  calculateBmi,
  calculatePackYears,
  cardiovascularRiskLabel,
  estimateTfgCkdEpi,
  formatTfgLabel,
  parseOptionalNumber,
} from "@/lib/utils/clinical-indicators";

interface Props {
  patientId: string;
  ageYears: number | null;
  extras: PatientChartExtras;
  canEdit: boolean;
}

function creatinineFromExtras(extras: PatientChartExtras): string {
  const lab = extras.labs?.find((l) => l.name.toLowerCase().includes("creatinina"));
  return lab?.value?.trim() ?? "";
}

export function PatientIndicatorsCalculator({ patientId, ageYears, extras, canEdit }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const [weightKg, setWeightKg] = useState(extras.weight_kg != null ? String(extras.weight_kg) : "");
  const [heightCm, setHeightCm] = useState(extras.height_cm != null ? String(extras.height_cm) : "");
  const [creatinine, setCreatinine] = useState(creatinineFromExtras(extras));
  const [cigsPerDay, setCigsPerDay] = useState(
    extras.cigarettes_per_day != null ? String(extras.cigarettes_per_day) : ""
  );
  const [smokingYears, setSmokingYears] = useState(
    extras.smoking_years != null ? String(extras.smoking_years) : ""
  );
  const [cvRisk, setCvRisk] = useState(extras.cardiovascular_risk ?? "");

  const preview = useMemo(() => {
    const w = parseOptionalNumber(weightKg);
    const h = parseOptionalNumber(heightCm);
    const cr = parseOptionalNumber(creatinine);
    const cigs = parseOptionalNumber(cigsPerDay);
    const years = parseOptionalNumber(smokingYears);

    const bmi = w && h ? calculateBmi(w, h) : null;
    const tfg =
      ageYears != null && cr
        ? formatTfgLabel(
            estimateTfgCkdEpi({
              ageYears,
              creatinineMgDl: cr,
              sex:
                extras.sex === "M" || extras.sex === "F" ? extras.sex : null,
            })
          )
        : null;
    const packYears =
      cigs != null && years != null ? calculatePackYears(cigs, years) : null;

    return {
      bmi: bmi != null ? String(bmi) : "—",
      tfg: tfg?.split(" ")[0] ?? "—",
      cv: cardiovascularRiskLabel(
        (cvRisk as "low" | "moderate" | "high" | "") || null
      ),
      packYears: packYears != null ? String(packYears) : "—",
    };
  }, [weightKg, heightCm, creatinine, cigsPerDay, smokingYears, cvRisk, ageYears, extras.sex]);

  if (!canEdit) return null;

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSaved(false);

    const result = await savePatientClinicalIndicators(patientId, {
      weightKg: parseOptionalNumber(weightKg),
      heightCm: parseOptionalNumber(heightCm),
      creatinineMgDl: parseOptionalNumber(creatinine),
      cigarettesPerDay: parseOptionalNumber(cigsPerDay),
      smokingYears: parseOptionalNumber(smokingYears),
      cardiovascularRisk:
        cvRisk === "low" || cvRisk === "moderate" || cvRisk === "high" ? cvRisk : null,
    });

    setLoading(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setSaved(true);
    router.refresh();
  }

  return (
    <div className="drflow-patient-chart-indicators-form mt-2">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-1.5 text-left text-[10px] font-semibold uppercase tracking-wide text-teal-300/90 hover:text-teal-200"
      >
        <Calculator className="h-3.5 w-3.5" />
        {open ? "Ocultar calculadora" : "Calcular indicadores"}
      </button>

      {open && (
        <form
          onSubmit={handleSave}
          className="mt-2 space-y-2 rounded-lg border border-slate-600/60 bg-slate-900/40 p-2"
        >
          <div className="grid grid-cols-2 gap-2">
            <Input
              label="Peso (kg)"
              type="text"
              inputMode="decimal"
              value={weightKg}
              onChange={(e) => setWeightKg(e.target.value)}
              placeholder="Ej: 72"
            />
            <Input
              label="Talla (cm)"
              type="text"
              inputMode="decimal"
              value={heightCm}
              onChange={(e) => setHeightCm(e.target.value)}
              placeholder="Ej: 165"
            />
            <Input
              label="Creatinina (mg/dL)"
              type="text"
              inputMode="decimal"
              value={creatinine}
              onChange={(e) => setCreatinine(e.target.value)}
              placeholder="Ej: 0.9"
            />
            <Select
              label="Riesgo CV"
              value={cvRisk}
              onChange={(e) => setCvRisk(e.target.value)}
              options={[
                { value: "", label: "Sin evaluar" },
                { value: "low", label: "Bajo" },
                { value: "moderate", label: "Moderado" },
                { value: "high", label: "Alto" },
              ]}
            />
            <Input
              label="Cigarrillos/día"
              type="text"
              inputMode="numeric"
              value={cigsPerDay}
              onChange={(e) => setCigsPerDay(e.target.value)}
              placeholder="Ej: 10"
            />
            <Input
              label="Años fumando"
              type="text"
              inputMode="decimal"
              value={smokingYears}
              onChange={(e) => setSmokingYears(e.target.value)}
              placeholder="Ej: 15"
            />
          </div>

          {ageYears == null && creatinine.trim() && (
            <p className="text-[10px] text-amber-300">
              Para TFG registrá la fecha de nacimiento del paciente.
            </p>
          )}

          <div className="grid grid-cols-2 gap-1 rounded-md bg-slate-950/50 px-2 py-1.5 text-[10px] text-slate-300">
            <span>
              IMC → <strong className="text-white">{preview.bmi}</strong>
            </span>
            <span>
              TFG → <strong className="text-white">{preview.tfg}</strong>
            </span>
            <span>
              Riesgo CV → <strong className="text-white">{preview.cv}</strong>
            </span>
            <span>
              P-año → <strong className="text-white">{preview.packYears}</strong>
            </span>
          </div>

          {error && <p className="text-xs text-red-400">{error}</p>}
          {saved && <p className="text-xs text-teal-300">Indicadores guardados.</p>}

          <Button type="submit" size="sm" loading={loading} pendingLabel="Guardando..." className="w-full">
            Guardar indicadores
          </Button>
        </form>
      )}
    </div>
  );
}
