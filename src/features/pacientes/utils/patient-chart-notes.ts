import type { PatientChartExtras } from "@/features/pacientes/utils/patient-chart-model-types";

export const CHART_JSON_MARKER = "DRFLOW_CHART_JSON:";

export function parsePatientChartExtras(notes: string | null | undefined): PatientChartExtras {
  if (!notes?.includes(CHART_JSON_MARKER)) return {};
  const idx = notes.indexOf(CHART_JSON_MARKER);
  const jsonPart = notes.slice(idx + CHART_JSON_MARKER.length).split("\n")[0]?.trim();
  if (!jsonPart) return {};
  try {
    return JSON.parse(jsonPart) as PatientChartExtras;
  } catch {
    return {};
  }
}

/** Texto libre de observaciones sin el bloque técnico JSON. */
export function stripChartJsonFromNotes(notes: string | null | undefined): string {
  if (!notes?.trim()) return "";
  if (!notes.includes(CHART_JSON_MARKER)) return notes.trim();
  const before = notes.slice(0, notes.indexOf(CHART_JSON_MARKER)).trim();
  const afterLine = notes.slice(notes.indexOf(CHART_JSON_MARKER)).split("\n").slice(1).join("\n").trim();
  return [before, afterLine].filter(Boolean).join("\n\n").trim();
}

export function mergeNotesWithChartExtras(
  freeNotes: string | null | undefined,
  extras: PatientChartExtras
): string | null {
  const cleaned = stripChartJsonFromNotes(freeNotes ?? "");
  const hasExtras = Object.keys(extras).some((k) => {
    const v = extras[k as keyof PatientChartExtras];
    if (v == null) return false;
    if (Array.isArray(v)) return v.length > 0;
    if (typeof v === "boolean") return v;
    return String(v).trim() !== "";
  });
  if (!hasExtras) return cleaned || null;
  const jsonLine = `${CHART_JSON_MARKER}${JSON.stringify(extras)}`;
  if (!cleaned) return jsonLine;
  return `${cleaned}\n\n${jsonLine}`;
}

export const STANDARD_VACCINE_NAMES = [
  "COVID",
  "Antigripal",
  "Neumococo",
  "Hepatitis B",
  "Tétanos",
] as const;

export const STANDARD_LAB_NAMES = [
  "HbA1c",
  "Creatinina",
  "Colesterol",
  "Triglicéridos",
  "PSA",
  "Hemoglobina",
  "Leucocitos",
] as const;

export type LabPanelRow = {
  name: string;
  value: string;
  unit?: string;
  status: "normal" | "high" | "low" | "unknown" | "empty";
  date?: string;
};

export function buildStandardLabPanel(labs: PatientChartExtras["labs"]): LabPanelRow[] {
  const byName = new Map((labs ?? []).map((l) => [l.name.toLowerCase(), l]));
  return STANDARD_LAB_NAMES.map((name) => {
    const found =
      byName.get(name.toLowerCase()) ??
      [...byName.entries()].find(([k]) => k.includes(name.toLowerCase().slice(0, 4)))?.[1];
    if (!found?.value?.trim()) {
      return { name, value: "—", status: "empty" as const };
    }
    return {
      name,
      value: found.value,
      unit: found.unit,
      status: found.status ?? "unknown",
      date: found.date,
    };
  });
}

export function mergeStandardVaccines(
  vaccines: PatientChartExtras["vaccines"]
): { name: string; status: "ok" | "warn" | "missing"; year?: string }[] {
  const byName = new Map((vaccines ?? []).map((v) => [v.name.toLowerCase(), v]));
  return STANDARD_VACCINE_NAMES.map((name) => {
    const found = byName.get(name.toLowerCase());
    if (found) return found;
    return { name, status: "missing" as const };
  });
}

export function chartProfileCompleteness(extras: PatientChartExtras): {
  score: number;
  missing: string[];
} {
  const missing: string[] = [];
  if (!extras.sex) missing.push("Sexo");
  if (!extras.blood_group) missing.push("Grupo sanguíneo");
  if (!extras.smoker) missing.push("Tabaquismo");
  const labs = extras.labs?.filter((l) => l.value?.trim()) ?? [];
  if (labs.length === 0) missing.push("Laboratorio reciente");
  const vac = extras.vaccines?.filter((v) => v.status === "ok") ?? [];
  if (vac.length < 2) missing.push("Vacunas");
  const total = 5;
  const score = Math.round(((total - missing.length) / total) * 100);
  return { score: Math.max(0, Math.min(100, score)), missing };
}

/** Lee campos del formulario de perfil clínico y arma extras. */
export function chartExtrasFromFormData(formData: FormData): PatientChartExtras {
  const str = (key: string) => {
    const v = formData.get(key);
    return typeof v === "string" && v.trim() ? v.trim() : undefined;
  };
  const bool = (key: string) => formData.get(key) === "on" || formData.get(key) === "true";

  const smoker = str("chart_smoker") as PatientChartExtras["smoker"] | undefined;
  const cv = str("chart_cv_risk") as PatientChartExtras["cardiovascular_risk"] | undefined;

  const packYearsRaw = str("chart_pack_years");
  const pack_years = packYearsRaw ? parseFloat(packYearsRaw.replace(",", ".")) : undefined;

  const family: PatientChartExtras["family_history"] = [];
  for (const rel of ["Padre", "Madre", "Hermanos"]) {
    const key = rel === "Padre" ? "chart_family_father" : rel === "Madre" ? "chart_family_mother" : "chart_family_siblings";
    const conditions = str(key);
    if (conditions) family.push({ relation: rel, conditions });
  }

  const vaccines = STANDARD_VACCINE_NAMES.map((name) => {
    const slug = name.toLowerCase().replace(/\s+/g, "_").replace(/ó/g, "o");
    const status = str(`chart_vaccine_${slug}`) as "ok" | "warn" | "missing" | undefined;
    const year = str(`chart_vaccine_${slug}_year`);
    if (!status || status === "missing") {
      if (!year) return null;
      return { name, status: "warn" as const, year };
    }
    return { name, status, year };
  }).filter((v): v is NonNullable<typeof v> => v != null);

  const labs: NonNullable<PatientChartExtras["labs"]> = [];
  for (const labName of STANDARD_LAB_NAMES) {
    const slug = labName.toLowerCase().replace(/[^a-z0-9]/g, "");
    const value = str(`chart_lab_${slug}`);
    if (!value) continue;
    const status = (str(`chart_lab_${slug}_status`) ?? "unknown") as
      | "normal"
      | "high"
      | "low"
      | "unknown";
    const unit = str(`chart_lab_${slug}_unit`);
    labs.push({ name: labName, value, status, unit });
  }

  return {
    sex: str("chart_sex"),
    blood_group: str("chart_blood_group"),
    smoker: smoker ?? null,
    alcohol: str("chart_alcohol") ?? null,
    activity: str("chart_activity") ?? null,
    diet: str("chart_diet") ?? null,
    occupation: str("chart_occupation") ?? null,
    pack_years: Number.isFinite(pack_years) ? pack_years : null,
    anticoagulated: bool("chart_anticoagulated"),
    pacemaker: bool("chart_pacemaker"),
    renal_failure: bool("chart_renal_failure"),
    heart_failure: bool("chart_heart_failure"),
    cardiovascular_risk: cv ?? null,
    family_history: family.length ? family : undefined,
    vaccines: vaccines.length ? vaccines : undefined,
    labs: labs.length ? labs : undefined,
  };
}
