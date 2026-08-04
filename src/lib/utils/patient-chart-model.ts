import { format } from "date-fns";
import { es } from "date-fns/locale";
import { calculateAge, formatAgeLabel } from "@/lib/utils/patient-age";
import { calculateBmi, estimateTfgCkdEpi, formatTfgLabel } from "@/lib/utils/clinical-indicators";
import { parseHabitualMedicationText } from "@/lib/utils/parse-habitual-meds";
import { sanitizeClinicalDisplayText } from "@/lib/utils/sanitize-clinical-display";
import {
  buildStandardLabPanel,
  mergeStandardVaccines,
  parsePatientChartExtras,
  chartProfileCompleteness,
} from "@/lib/utils/patient-chart-notes";
import type { PrescriptionMedication } from "@/types/prescription";
import { buildMedicationSafetyWarnings } from "@/lib/utils/clinical-assistant";
import type {
  ActiveProblem,
  ChartAlert,
  ConsultationTimelineItem,
  MedicationCard,
  PatientChartExtras,
  PatientChartPayload,
  StudyDocumentItem,
  VitalReading,
} from "@/lib/utils/patient-chart-types";

function splitList(text: string | null | undefined): string[] {
  if (!text?.trim()) return [];
  return text
    .split(/[\n,;]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function containsAny(hay: string, terms: string[]): boolean {
  const h = hay.toLowerCase();
  return terms.some((t) => h.includes(t));
}

function parseVitalsFromText(raw: string, id: string, created_at: string): VitalReading | null {
  const text = sanitizeClinicalDisplayText(raw);
  if (!text) return null;
  const ta = text.match(/TA\s*(\d{2,3})\s*\/\s*(\d{2,3})/i);
  const weight = text.match(/Peso\s*(\d+(?:[.,]\d+)?)\s*kg/i);
  const height = text.match(/Talla\s*(\d+(?:[.,]\d+)?)\s*cm/i);
  const fc = text.match(/FC\s*(\d{2,3})/i);
  const temp = text.match(/Temp(?:eratura)?\s*(\d+(?:[.,]\d+)?)/i);
  const spo2 = text.match(/Sat\s*O?[₂2]?\s*(\d{2,3})\s*%?/i);
  const abdominal = text.match(/(?:Per[ií]metro|P\.?\s*abdominal)\s*(\d+(?:[.,]\d+)?)\s*cm/i);
  const w = weight ? parseFloat(weight[1].replace(",", ".")) : undefined;
  const h = height ? parseFloat(height[1].replace(",", ".")) : undefined;
  let bmi: number | undefined;
  if (w && h && h > 0) {
    const hm = h / 100;
    bmi = Math.round((w / (hm * hm)) * 10) / 10;
  }
  return {
    id,
    date: created_at,
    label: text.slice(0, 120),
    systolic: ta ? parseInt(ta[1], 10) : undefined,
    diastolic: ta ? parseInt(ta[2], 10) : undefined,
    weightKg: w,
    heightCm: h,
    bmi,
    heartRate: fc ? parseInt(fc[1], 10) : undefined,
    temperature: temp ? parseFloat(temp[1].replace(",", ".")) : undefined,
    spo2: spo2 ? parseInt(spo2[1], 10) : undefined,
    abdominalCm: abdominal ? parseFloat(abdominal[1].replace(",", ".")) : undefined,
    raw: text,
  };
}

function estimateTfg(
  age: number | null,
  creatinineMgDl?: number,
  sex?: "M" | "F" | null
): string | null {
  if (age === null || !creatinineMgDl || creatinineMgDl <= 0) return null;
  const value = estimateTfgCkdEpi({ ageYears: age, creatinineMgDl, sex });
  return formatTfgLabel(value);
}

function buildAlerts(input: {
  allergies: string[];
  history: string;
  meds: string;
  extras: PatientChartExtras;
}): ChartAlert[] {
  const alerts: ChartAlert[] = [];
  const blob = `${input.history} ${input.meds}`.toLowerCase();

  for (const a of input.allergies) {
    alerts.push({ level: "red", label: `Alergia: ${a}` });
  }
  if (input.extras.anticoagulated || containsAny(blob, ["anticoag", "warfarina", "acenocumarol", "rivaroxaban", "apixaban"])) {
    alerts.push({ level: "red", label: "Anticoagulado" });
  }
  if (input.extras.pacemaker || containsAny(blob, ["marcapasos"])) {
    alerts.push({ level: "red", label: "Marcapasos" });
  }
  if (input.extras.renal_failure || containsAny(blob, ["insuficiencia renal", "irc", "creatinina elevada"])) {
    alerts.push({ level: "red", label: "Insuficiencia renal" });
  }
  if (input.extras.heart_failure || containsAny(blob, ["insuficiencia cardíaca", "icc"])) {
    alerts.push({ level: "red", label: "Insuficiencia cardíaca" });
  }
  if (containsAny(blob, ["diabetes", "dm2", "dm tipo"])) {
    alerts.push({ level: "yellow", label: "Diabetes" });
  }
  if (containsAny(blob, ["hipertens", " hta", "hta"])) {
    alerts.push({ level: "yellow", label: "Hipertensión" });
  }
  if (input.extras.cardiovascular_risk === "high") {
    alerts.push({ level: "yellow", label: "Riesgo CV alto" });
  }
  if (containsAny(blob, ["obesidad", "obeso"])) {
    alerts.push({ level: "yellow", label: "Obesidad" });
  }
  if (input.extras.smoker === "active" || containsAny(blob, ["tabaquismo", "fumador activo"])) {
    alerts.push({ level: "yellow", label: "Tabaquismo" });
  }
  const vaccinesOk = input.extras.vaccines?.every((v) => v.status === "ok");
  if (input.extras.vaccines?.length && vaccinesOk) {
    alerts.push({ level: "green", label: "Vacunas completas" });
  }

  const seen = new Set<string>();
  return alerts.filter((a) => {
    const k = `${a.level}:${a.label}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

function buildSafetyWarnings(allergies: string[], meds: MedicationCard[], anticoagulated: boolean): string[] {
  return buildMedicationSafetyWarnings({ allergies, medications: meds, anticoagulated });
}

function buildReminders(input: {
  lastConsultMonths: number | null;
  extras: PatientChartExtras;
  history: string;
}): string[] {
  const r: string[] = [];
  if (input.lastConsultMonths !== null && input.lastConsultMonths >= 12) {
    r.push(`Paciente sin control hace ${input.lastConsultMonths} meses`);
  }
  if (containsAny(input.history, ["diabetes", "dm"])) {
    const hba1c = input.extras.labs?.find((l) => l.name.toLowerCase().includes("hba1c"));
    if (!hba1c) r.push("Diabético: sin HbA1c reciente registrada");
  }
  if (containsAny(input.history, ["hipertens", "hta"])) {
    r.push("HTA: verificar control de presión en consulta");
  }
  const flu = input.extras.vaccines?.find((v) => v.name.toLowerCase().includes("antigripal"));
  if (flu?.status === "missing" || flu?.status === "warn") {
    r.push("Falta vacuna antigripal al día");
  }
  return r;
}

export function buildPatientChartPayload(input: {
  patient: {
    birth_date: string | null;
    insurance_provider: string | null;
    medical_history: string | null;
    allergies: string | null;
    regular_medication: string | null;
    notes: string | null;
  };
  records: Array<{
    id: string;
    created_at: string;
    chief_complaint: string | null;
    diagnosis: string | null;
    evolution: string | null;
    indications: string | null;
    professional_name: string;
  }>;
  prescriptions: Array<{ id: string; created_at: string; medications: unknown }>;
  attachments: StudyDocumentItem[];
}): PatientChartPayload {
  const extras = parsePatientChartExtras(input.patient.notes);
  const ageYears = calculateAge(input.patient.birth_date);
  const ageLabel = formatAgeLabel(input.patient.birth_date);
  const allergies = splitList(input.patient.allergies);
  const historyText = input.patient.medical_history ?? "";
  const chronicFromHistory = splitList(historyText);

  const problems: ActiveProblem[] = [];
  const seenDiag = new Set<string>();
  for (const r of input.records) {
    const diag = sanitizeClinicalDisplayText(r.diagnosis ?? "");
    if (!diag || diag.length < 3) continue;
    const key = diag.toLowerCase().slice(0, 80);
    if (seenDiag.has(key)) continue;
    seenDiag.add(key);
    problems.push({
      id: `p-${r.id}`,
      name: diag,
      dateLabel: format(new Date(r.created_at), "dd/MM/yyyy", { locale: es }),
      status: "active",
      professionalName: r.professional_name,
      recordId: r.id,
    });
  }
  for (const line of chronicFromHistory.slice(0, 8)) {
    const key = line.toLowerCase();
    if (seenDiag.has(key)) continue;
    seenDiag.add(key);
    problems.push({
      id: `h-${key}`,
      name: line,
      dateLabel: "—",
      status: "active",
      professionalName: "Antecedentes",
    });
  }

  const lastRx = input.prescriptions[0];
  const lastRxDate = lastRx
    ? format(new Date(lastRx.created_at), "dd/MM/yyyy", { locale: es })
    : "—";
  const medSource =
    (lastRx?.medications as PrescriptionMedication[] | undefined)?.length
      ? (lastRx.medications as PrescriptionMedication[])
      : parseHabitualMedicationText(input.patient.regular_medication);

  const medications: MedicationCard[] = medSource.map((m, i) => ({
    id: `med-${i}`,
    name: m.generic_name || m.brand_name || "Medicamento",
    dose: m.concentration || "—",
    frequency: m.posology || "—",
    sinceLabel: "Habitual",
    lastRenewalLabel: lastRxDate,
    raw: m,
  }));

  const vitals: VitalReading[] = [];
  for (const r of input.records) {
    const cc = (r.chief_complaint ?? "").toLowerCase();
    const body = `${r.evolution ?? ""} ${r.chief_complaint ?? ""}`;
    if (cc.includes("signos vitales") || /TA\s*\d/i.test(body)) {
      const v = parseVitalsFromText(body, r.id, r.created_at);
      if (v) vitals.push(v);
    }
  }
  vitals.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const latest = vitals[0];
  const weightKg = latest?.weightKg ?? extras.weight_kg ?? undefined;
  const heightCm = latest?.heightCm ?? extras.height_cm ?? undefined;
  const bmiValue =
    latest?.bmi ??
    (weightKg && heightCm ? calculateBmi(weightKg, heightCm) ?? undefined : undefined);

  const latestVitals = {
    ta: latest?.systolic ? `${latest.systolic}/${latest.diastolic}` : undefined,
    fc: latest?.heartRate ? `${latest.heartRate} lpm` : undefined,
    weight: weightKg != null ? `${weightKg} kg` : undefined,
    height: heightCm != null ? `${heightCm} cm` : undefined,
    bmi: bmiValue != null ? String(bmiValue) : undefined,
    temp: latest?.temperature != null ? `${latest.temperature} °C` : undefined,
    spo2: latest?.spo2 != null ? `${latest.spo2}%` : undefined,
    abdominal: latest?.abdominalCm != null ? `${latest.abdominalCm} cm` : undefined,
  };

  const labPanel = buildStandardLabPanel(extras.labs);
  const profileCompleteness = chartProfileCompleteness(extras);
  const vaccinesMerged = mergeStandardVaccines(extras.vaccines);

  const sexLabel =
    extras.sex === "F"
      ? "Femenino"
      : extras.sex === "M"
        ? "Masculino"
        : extras.sex === "X"
          ? "Otro"
          : "Sin definir";

  const consultations: ConsultationTimelineItem[] = input.records.slice(0, 8).map((r) => ({
    id: r.id,
    dateLabel: format(new Date(r.created_at), "dd/MM/yyyy", { locale: es }),
    motive: sanitizeClinicalDisplayText(r.chief_complaint) || "Consulta",
    diagnosis: sanitizeClinicalDisplayText(r.diagnosis) || "—",
    conduct: sanitizeClinicalDisplayText(r.indications || r.evolution) || "—",
  }));

  const lastConsult = input.records[0];
  const lastConsultMonths = lastConsult
    ? Math.floor(
        (Date.now() - new Date(lastConsult.created_at).getTime()) / (1000 * 60 * 60 * 24 * 30)
      )
    : null;

  const creatinineLab = extras.labs?.find((l) => l.name.toLowerCase().includes("creatinina"));
  const creatVal = creatinineLab?.value ? parseFloat(creatinineLab.value.replace(",", ".")) : undefined;

  const smokingLabel =
    extras.smoker === "active"
      ? "Fumador activo"
      : extras.smoker === "former"
        ? "Ex fumador"
        : containsAny(historyText, ["ex fumador"])
          ? "Ex fumador"
          : containsAny(historyText, ["fumador", "tabaco"])
            ? "Fumador"
            : "Sin registrar";

  const alerts = buildAlerts({
    allergies,
    history: historyText,
    meds: input.patient.regular_medication ?? "",
    extras,
  });

  const studies = input.attachments.filter((a) => a.category === "estudio");
  const documents = input.attachments;

  return {
    ageLabel,
    ageYears,
    sex: sexLabel,
    insurance: input.patient.insurance_provider ?? "Sin definir",
    bloodGroup: extras.blood_group ?? "Sin registrar",
    activeProblemsText: problems.slice(0, 6).map((p) => p.name),
    chronicConditions: chronicFromHistory,
    allergies,
    criticalMeds: medications.slice(0, 4).map((m) => m.name),
    anticoagulated: alerts.some((a) => a.label === "Anticoagulado"),
    cvRisk:
      extras.cardiovascular_risk === "high"
        ? "Alto"
        : extras.cardiovascular_risk === "moderate"
          ? "Moderado"
          : extras.cardiovascular_risk === "low"
            ? "Bajo"
            : "Sin evaluar",
    smokingLabel,
    alerts,
    problems,
    medications,
    vitals,
    latestVitals,
    labPanel,
    profileCompleteness,
    consultations,
    labs: extras.labs ?? [],
    vaccines: vaccinesMerged,
    habits: {
      smoker: smokingLabel,
      alcohol: extras.alcohol ?? "Sin registrar",
      activity: extras.activity ?? "Sin registrar",
      diet: extras.diet ?? "Sin registrar",
      occupation: extras.occupation ?? "Sin registrar",
      packYears: extras.pack_years != null ? String(extras.pack_years) : "—",
    },
    family: extras.family_history ?? [],
    studies,
    documents,
    reminders: buildReminders({ lastConsultMonths, extras, history: historyText }),
    safetyWarnings: buildSafetyWarnings(allergies, medications, alerts.some((a) => a.label === "Anticoagulado")),
    indicators: {
      bmi: latestVitals.bmi ?? null,
      tfg: estimateTfg(ageYears, creatVal, extras.sex === "M" || extras.sex === "F" ? extras.sex : null),
      cvScore: extras.cardiovascular_risk ? extras.cardiovascular_risk.toUpperCase() : null,
      packYears: extras.pack_years != null ? String(extras.pack_years) : null,
      creatinine: creatVal != null && Number.isFinite(creatVal) ? String(creatVal) : null,
    },
    extras,
  };
}
