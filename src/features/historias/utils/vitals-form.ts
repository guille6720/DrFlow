export type VitalsFormValues = {
  tas: string;
  tad: string;
  fc: string;
  fr: string;
  temperature: string;
  satO2: string;
  weight: string;
  height: string;
  recordedAt: string;
};

export const EMPTY_VITALS_FORM: VitalsFormValues = {
  tas: "",
  tad: "",
  fc: "",
  fr: "",
  temperature: "",
  satO2: "",
  weight: "",
  height: "",
  recordedAt: "",
};

export function computeBmi(weightKg: string, heightCm: string): string | null {
  const w = Number(weightKg.replace(",", "."));
  const hCm = Number(heightCm.replace(",", "."));
  if (!Number.isFinite(w) || !Number.isFinite(hCm) || w <= 0 || hCm <= 0) return null;
  const h = hCm / 100;
  const bmi = w / (h * h);
  if (!Number.isFinite(bmi)) return null;
  return bmi.toFixed(1);
}

/** Serializes only filled vitals for clinical_records.evolution. */
export function formatVitalsForEvolution(values: VitalsFormValues): string {
  const parts: string[] = [];
  const tas = values.tas.trim();
  const tad = values.tad.trim();
  if (tas || tad) {
    parts.push(`TA ${tas || "—"}/${tad || "—"} mmHg`);
  }
  if (values.fc.trim()) parts.push(`FC ${values.fc.trim()} lpm`);
  if (values.fr.trim()) parts.push(`FR ${values.fr.trim()} rpm`);
  if (values.temperature.trim()) parts.push(`T° ${values.temperature.trim()} °C`);
  if (values.satO2.trim()) parts.push(`SatO2 ${values.satO2.trim()} %`);
  if (values.weight.trim()) parts.push(`Peso ${values.weight.trim()} kg`);
  if (values.height.trim()) parts.push(`Altura ${values.height.trim()} cm`);
  const bmi = computeBmi(values.weight, values.height);
  if (bmi) parts.push(`IMC ${bmi}`);
  if (values.recordedAt.trim()) {
    const d = new Date(values.recordedAt);
    if (!Number.isNaN(d.getTime())) {
      parts.push(
        `Registrado ${d.toLocaleString("es-AR", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        })}`
      );
    }
  }
  return parts.join(" · ");
}

export function vitalsFormHasAnyValue(values: VitalsFormValues): boolean {
  return Boolean(
    values.tas.trim() ||
      values.tad.trim() ||
      values.fc.trim() ||
      values.fr.trim() ||
      values.temperature.trim() ||
      values.satO2.trim() ||
      values.weight.trim() ||
      values.height.trim()
  );
}
