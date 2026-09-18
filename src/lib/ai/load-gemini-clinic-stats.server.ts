import "server-only";

import { addMonths } from "date-fns";
import { es } from "date-fns/locale";
import { formatInTimeZone, fromZonedTime, toZonedTime } from "date-fns-tz";

import { createClient } from "@/core/supabase/server";

import { DEFAULT_CLINIC_TIMEZONE } from "@/shared/utils/clinic-timezone";

import { parsePatientChartExtras } from "@/features/pacientes/utils/patient-chart-notes";

import {
  formatProtocolCatalogForPrompt,
  type GeminiClinicStatsQuery,
  type GeminiClinicStatsResult,
  type GeminiStatsPatientRow,
  type GeminiStatsPeriodId,
  textMatchesCondition,
} from "@/lib/ai/gemini-clinic-stats";
import {
  compareHtaDiureticRiskScores,
  type HtaDiureticRiskScore,
  scoreHtaDiureticRisk,
} from "@/lib/ai/hta-diuretic-risk-eligibility";
import { getAttendancePeriodBounds } from "@/lib/utils/attendance-stats";

const RECORD_LIMIT = 2500;
const PATIENT_LIST_LIMIT = 200;

type RecordRow = {
  created_at: string;
  diagnosis: string | null;
  chief_complaint: string | null;
  evolution: string | null;
  indications?: string | null;
  treatments_json?: unknown;
  patient_id: string;
  patients:
    | {
        id: string;
        first_name: string;
        last_name: string;
        insurance_provider: string | null;
        birth_date?: string | null;
        regular_medication?: string | null;
        medical_history?: string | null;
        notes?: string | null;
      }
    | Array<{
        id: string;
        first_name: string;
        last_name: string;
        insurance_provider: string | null;
        birth_date?: string | null;
        regular_medication?: string | null;
        medical_history?: string | null;
        notes?: string | null;
      }>
    | null;
};

type ProfileRow = {
  patient_id: string;
  notes: string | null;
  regular_medication: string | null;
  medical_history: string | null;
};

type TreatmentRow = {
  patient_id: string;
  product: string | null;
};

function resolvePeriodBounds(period: GeminiStatsPeriodId, now: Date, timeZone: string) {
  if (period === "all") {
    return {
      start: addMonths(now, -60),
      end: now,
      label: "histórico en NexClinic (últimos 5 años)",
    };
  }
  if (period === "last_month") {
    return getAttendancePeriodBounds("monthly", addMonths(now, -1), timeZone);
  }
  if (period === "year") {
    const zoned = toZonedTime(now, timeZone);
    const startLocal = new Date(zoned.getFullYear(), 0, 1, 0, 0, 0, 0);
    const endLocal = new Date(zoned.getFullYear() + 1, 0, 1, 0, 0, 0, 0);
    return {
      start: fromZonedTime(startLocal, timeZone),
      end: fromZonedTime(endLocal, timeZone),
      label: formatInTimeZone(fromZonedTime(startLocal, timeZone), timeZone, "yyyy", { locale: es }),
    };
  }
  return getAttendancePeriodBounds(period, now, timeZone);
}

function emptyStatsResult(
  query: GeminiClinicStatsQuery,
  label: string
): GeminiClinicStatsResult {
  return {
    periodLabel: label,
    conditionLabel: query.condition?.label ?? null,
    coverageLabel: query.coverageNeedle,
    visitCount: 0,
    patientCount: 0,
    truncated: false,
    patients: [],
    topDiagnoses: [],
    protocolLabel: query.protocol?.label ?? null,
    protocolContext: query.protocol
      ? formatProtocolCatalogForPrompt(query.protocol)
      : query.wantProtocolCriteria
        ? formatProtocolCatalogForPrompt()
        : null,
  };
}

function asPatient(value: RecordRow["patients"]) {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function normalizeDiagnosis(value: string): string {
  const trimmed = value.replace(/\s+/g, " ").trim();
  if (!trimmed) return "Sin diagnóstico";
  return trimmed.slice(0, 80);
}

function treatmentsJsonToText(value: unknown): string {
  if (!Array.isArray(value)) return "";
  return value
    .map((item) => {
      if (!item || typeof item !== "object") return "";
      const row = item as Record<string, unknown>;
      return [row.product, row.name, row.dose, row.frequency].filter(Boolean).join(" ");
    })
    .filter(Boolean)
    .join(" ");
}

function screeningProtocolContext(query: GeminiClinicStatsQuery): string | null {
  const base = query.protocol
    ? formatProtocolCatalogForPrompt(query.protocol)
    : query.wantProtocolCriteria
      ? formatProtocolCatalogForPrompt()
      : null;
  if (!query.htaDiureticRiskScreening) return base;
  const screeningNote = [
    "Screening multi-factor DrFlow (determinístico):",
    "Gate: ≥ 2 antihipertensivos incluyendo ≥ 1 diurético.",
    "Factores (≥ 2): edad > 70; tabaquista; fibrilación auricular; diabetes; IMC ≥ 30; filtrado glomerular < 60.",
    "Orden del listado: primero quienes tienen TODOS los factores; luego por cantidad de factores.",
  ].join("\n");
  return [base, screeningNote].filter(Boolean).join("\n\n");
}

async function loadPatientEnrichment(
  clinicId: string,
  patientIds: string[]
): Promise<{
  profiles: Map<string, ProfileRow>;
  treatments: Map<string, string[]>;
}> {
  const profiles = new Map<string, ProfileRow>();
  const treatments = new Map<string, string[]>();
  if (patientIds.length === 0) return { profiles, treatments };

  const supabase = await createClient();

  const { data: profileData } = await supabase
    .from("patient_clinical_profiles")
    .select("patient_id, notes, regular_medication, medical_history")
    .eq("clinic_id", clinicId)
    .in("patient_id", patientIds);

  for (const row of (profileData ?? []) as ProfileRow[]) {
    profiles.set(row.patient_id, row);
  }

  const { data: txData } = await supabase
    .from("clinical_record_treatments")
    .select("patient_id, product")
    .eq("clinic_id", clinicId)
    .in("patient_id", patientIds)
    .limit(4000);

  for (const row of (txData ?? []) as TreatmentRow[]) {
    if (!row.patient_id || !row.product) continue;
    const list = treatments.get(row.patient_id) ?? [];
    list.push(row.product);
    treatments.set(row.patient_id, list);
  }

  return { profiles, treatments };
}

type AggregatedPatient = {
  row: GeminiStatsPatientRow;
  hcBlob: string;
  birthDate: string | null;
  regularMedication: string | null;
  medicalHistory: string | null;
  notes: string | null;
  treatmentsText: string;
  score?: HtaDiureticRiskScore;
};

export async function loadGeminiClinicStats(
  clinicId: string,
  query: GeminiClinicStatsQuery,
  now = new Date(),
  timeZone = DEFAULT_CLINIC_TIMEZONE
): Promise<GeminiClinicStatsResult> {
  const { start, end, label } = resolvePeriodBounds(query.period, now, timeZone);
  const supabase = await createClient();
  const useScreening = query.htaDiureticRiskScreening;

  // Single select shape so PostgREST typings stay valid (dynamic select → ParserError).
  const { data, error } = await supabase
    .from("clinical_records")
    .select(
      "created_at, diagnosis, chief_complaint, evolution, indications, treatments_json, patient_id, patients(id, first_name, last_name, insurance_provider, birth_date, regular_medication, medical_history, notes)"
    )
    .eq("clinic_id", clinicId)
    .gte("created_at", start.toISOString())
    .lt("created_at", end.toISOString())
    .order("created_at", { ascending: false })
    .limit(RECORD_LIMIT);

  if (error) {
    return emptyStatsResult(query, label);
  }

  const rows = (data ?? []) as unknown as RecordRow[];
  const truncated = rows.length >= RECORD_LIMIT;

  const filtered = rows.filter((row) => {
    const patient = asPatient(row.patients);
    if (query.coverageNeedle) {
      const coverage = (patient?.insurance_provider ?? "").toLowerCase();
      if (!coverage.includes(query.coverageNeedle)) return false;
    }
    if (!query.condition) return true;
    const blob = `${row.diagnosis ?? ""} ${row.chief_complaint ?? ""} ${row.evolution ?? ""} ${row.indications ?? ""} ${treatmentsJsonToText(row.treatments_json)}`;
    return textMatchesCondition(blob, query.condition);
  });

  const byPatient = new Map<string, AggregatedPatient>();
  const diagnosisCounts = new Map<string, number>();

  for (const row of filtered) {
    const patient = asPatient(row.patients);
    if (!patient) continue;
    const diagnosis = normalizeDiagnosis(row.diagnosis ?? row.chief_complaint ?? "");
    diagnosisCounts.set(diagnosis, (diagnosisCounts.get(diagnosis) ?? 0) + 1);

    const recordBlob = [
      row.diagnosis,
      row.chief_complaint,
      row.evolution,
      row.indications,
      treatmentsJsonToText(row.treatments_json),
    ]
      .filter(Boolean)
      .join(" ");

    const existing = byPatient.get(patient.id);
    if (existing) {
      existing.hcBlob = `${existing.hcBlob} ${recordBlob}`.trim();
      existing.treatmentsText = `${existing.treatmentsText} ${treatmentsJsonToText(row.treatments_json)}`.trim();
      continue;
    }

    byPatient.set(patient.id, {
      row: {
        id: patient.id,
        name: `${patient.last_name}, ${patient.first_name}`,
        date: String(row.created_at).slice(0, 10),
        diagnosis,
        coverage: patient.insurance_provider?.trim() || null,
      },
      hcBlob: recordBlob,
      birthDate: patient.birth_date ?? null,
      regularMedication: patient.regular_medication ?? null,
      medicalHistory: patient.medical_history ?? null,
      notes: patient.notes ?? null,
      treatmentsText: treatmentsJsonToText(row.treatments_json),
    });
  }

  let patients: GeminiStatsPatientRow[] = [];
  let patientCount = byPatient.size;
  const visitCount = filtered.length;

  if (useScreening && byPatient.size > 0) {
    const { profiles, treatments } = await loadPatientEnrichment(clinicId, [...byPatient.keys()]);

    const scored: AggregatedPatient[] = [];
    for (const [patientId, agg] of byPatient) {
      const profile = profiles.get(patientId);
      const chartExtras = parsePatientChartExtras(profile?.notes ?? agg.notes);
      const meds = [
        agg.regularMedication,
        profile?.regular_medication,
        ...(treatments.get(patientId) ?? []),
        agg.treatmentsText,
      ]
        .filter(Boolean)
        .join(" ");
      const score = scoreHtaDiureticRisk({
        birthDate: agg.birthDate,
        sex: chartExtras.sex,
        regularMedication: meds,
        medicalHistory: profile?.medical_history ?? agg.medicalHistory,
        hcBlob: agg.hcBlob,
        treatmentsText: meds,
        chartExtras,
        now,
      });
      if (!score.eligible) continue;
      scored.push({
        ...agg,
        score,
        row: {
          ...agg.row,
          matchSummary: score.summaryLabel,
          factorCount: score.factorCount,
          factors: score.factors,
          hasAllFactors: score.hasAllFactors,
          diagnosis: score.hasAllFactors
            ? `[TODOS] ${agg.row.diagnosis}`
            : `[${score.factorCount}/6] ${agg.row.diagnosis}`,
        },
      });
    }

    scored.sort((a, b) => compareHtaDiureticRiskScores(a.score!, b.score!));
    patients = scored.slice(0, PATIENT_LIST_LIMIT).map((item) => item.row);
    patientCount = scored.length;
    // Visitas: conservar filtrado por texto; el listado de pacientes es el elegible.
  } else {
    patients =
      query.wantTopDiagnoses && !query.condition
        ? []
        : [...byPatient.values()].slice(0, PATIENT_LIST_LIMIT).map((item) => item.row);
  }

  const topDiagnoses = [...diagnosisCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([diagLabel, count]) => ({ label: diagLabel, count }));

  return {
    periodLabel: label,
    conditionLabel: useScreening
      ? "≥2 antihipertensivos (con diurético) + ≥2 factores de riesgo"
      : (query.condition?.label ?? null),
    coverageLabel: query.coverageNeedle ? query.coverageNeedle.toUpperCase() : null,
    visitCount,
    patientCount,
    truncated,
    patients,
    topDiagnoses,
    protocolLabel: query.protocol?.label ?? null,
    protocolContext: screeningProtocolContext(query),
  };
}
