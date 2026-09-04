import "server-only";

import { addMonths } from "date-fns";
import { es } from "date-fns/locale";
import { formatInTimeZone, fromZonedTime, toZonedTime } from "date-fns-tz";

import { createClient } from "@/core/supabase/server";

import { DEFAULT_CLINIC_TIMEZONE } from "@/shared/utils/clinic-timezone";

import {
  formatProtocolCatalogForPrompt,
  type GeminiClinicStatsQuery,
  type GeminiClinicStatsResult,
  type GeminiStatsPatientRow,
  type GeminiStatsPeriodId,
  textMatchesCondition,
} from "@/lib/ai/gemini-clinic-stats";
import { getAttendancePeriodBounds } from "@/lib/utils/attendance-stats";

const RECORD_LIMIT = 2500;
const PATIENT_LIST_LIMIT = 200;

type RecordRow = {
  created_at: string;
  diagnosis: string | null;
  chief_complaint: string | null;
  evolution: string | null;
  patient_id: string;
  patients:
    | {
        id: string;
        first_name: string;
        last_name: string;
        insurance_provider: string | null;
      }
    | Array<{
        id: string;
        first_name: string;
        last_name: string;
        insurance_provider: string | null;
      }>
    | null;
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

export async function loadGeminiClinicStats(
  clinicId: string,
  query: GeminiClinicStatsQuery,
  now = new Date(),
  timeZone = DEFAULT_CLINIC_TIMEZONE
): Promise<GeminiClinicStatsResult> {
  const { start, end, label } = resolvePeriodBounds(query.period, now, timeZone);
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("clinical_records")
    .select(
      "created_at, diagnosis, chief_complaint, evolution, patient_id, patients(id, first_name, last_name, insurance_provider)"
    )
    .eq("clinic_id", clinicId)
    .gte("created_at", start.toISOString())
    .lt("created_at", end.toISOString())
    .order("created_at", { ascending: false })
    .limit(RECORD_LIMIT);

  if (error) {
    return emptyStatsResult(query, label);
  }

  const rows = (data ?? []) as RecordRow[];
  const truncated = rows.length >= RECORD_LIMIT;

  const filtered = rows.filter((row) => {
    const patient = asPatient(row.patients);
    if (query.coverageNeedle) {
      const coverage = (patient?.insurance_provider ?? "").toLowerCase();
      if (!coverage.includes(query.coverageNeedle)) return false;
    }
    if (!query.condition) return true;
    const blob = `${row.diagnosis ?? ""} ${row.chief_complaint ?? ""} ${row.evolution ?? ""}`;
    return textMatchesCondition(blob, query.condition);
  });

  const byPatient = new Map<string, GeminiStatsPatientRow>();
  const uniqueIds = new Set<string>();
  const diagnosisCounts = new Map<string, number>();

  for (const row of filtered) {
    const patient = asPatient(row.patients);
    if (!patient) continue;
    const diagnosis = normalizeDiagnosis(row.diagnosis ?? row.chief_complaint ?? "");
    diagnosisCounts.set(diagnosis, (diagnosisCounts.get(diagnosis) ?? 0) + 1);
    uniqueIds.add(patient.id);

    if (!byPatient.has(patient.id) && byPatient.size < PATIENT_LIST_LIMIT) {
      byPatient.set(patient.id, {
        id: patient.id,
        name: `${patient.last_name}, ${patient.first_name}`,
        date: String(row.created_at).slice(0, 10),
        diagnosis,
        coverage: patient.insurance_provider?.trim() || null,
      });
    }
  }

  const topDiagnoses = [...diagnosisCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([diagLabel, count]) => ({ label: diagLabel, count }));

  return {
    periodLabel: label,
    conditionLabel: query.condition?.label ?? null,
    coverageLabel: query.coverageNeedle ? query.coverageNeedle.toUpperCase() : null,
    visitCount: filtered.length,
    patientCount: uniqueIds.size,
    truncated,
    patients: query.wantTopDiagnoses && !query.condition ? [] : [...byPatient.values()],
    topDiagnoses,
    protocolLabel: query.protocol?.label ?? null,
    protocolContext: query.protocol
      ? formatProtocolCatalogForPrompt(query.protocol)
      : query.wantProtocolCriteria
        ? formatProtocolCatalogForPrompt()
        : null,
  };
}
