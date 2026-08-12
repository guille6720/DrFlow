"use client";

import { CalendarClock } from "lucide-react";
import { useMemo } from "react";

import { Input } from "@/components/ui/input";
import {
  AGENDA_PRESETS,
  type AgendaRuleDraft,
  WEEKDAY_LABELS,
} from "@/lib/constants/professional-intake-checklist";

interface Props {
  rules: AgendaRuleDraft[];
  onChange: (rules: AgendaRuleDraft[]) => void;
  readOnly?: boolean;
}

const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];

export function ProfessionalScheduleEditor({ rules, onChange, readOnly }: Props) {
  const summaryCount = useMemo(() => {
    const days = new Set(rules.map((r) => r.day_of_week));
    return days.size;
  }, [rules]);

  function applyPreset(presetId: string) {
    if (readOnly) return;
    const preset = AGENDA_PRESETS.find((p) => p.id === presetId);
    if (preset) onChange(preset.rules.map((r) => ({ ...r })));
  }

  function toggleDay(day: number, enabled: boolean) {
    if (readOnly) return;
    if (enabled) {
      if (rules.some((r) => r.day_of_week === day)) return;
      onChange([
        ...rules,
        { day_of_week: day, start_time: "09:00", end_time: "18:00", slot_duration: 30 },
      ]);
    } else {
      onChange(rules.filter((r) => r.day_of_week !== day));
    }
  }

  function updateDayRule(day: number, patch: Partial<AgendaRuleDraft>) {
    if (readOnly) return;
    onChange(rules.map((r) => (r.day_of_week === day ? { ...r, ...patch } : r)));
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-600">
        Definí los días y rangos horarios de atención. Valen para todos los meses del año: con esto
        podés armar la agenda de diciembre (u otro mes) desde Agenda o Nuevo turno. También alimentan
        los turnos online del consultorio.
      </p>

      {!readOnly ? (
        <div className="flex flex-wrap gap-2">
          {AGENDA_PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              onClick={() => applyPreset(preset.id)}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:border-teal-300 hover:bg-teal-50"
            >
              {preset.label}
            </button>
          ))}
        </div>
      ) : null}

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="grid grid-cols-[minmax(120px,140px)_1fr] border-b border-slate-100 bg-slate-50 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
          <span>Día</span>
          <span>Rango horario</span>
        </div>

        {WEEK_ORDER.map((day) => {
          const rule = rules.find((r) => r.day_of_week === day);
          const enabled = Boolean(rule);

          return (
            <div
              key={day}
              className="grid grid-cols-1 gap-3 border-b border-slate-100 px-4 py-3 last:border-0 sm:grid-cols-[minmax(120px,140px)_1fr]"
            >
              <label className="inline-flex items-center gap-2 text-sm font-medium text-slate-800">
                <input
                  type="checkbox"
                  checked={enabled}
                  disabled={readOnly}
                  onChange={(e) => toggleDay(day, e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-teal-600 disabled:opacity-60"
                />
                {WEEKDAY_LABELS[day]}
              </label>

              {enabled && rule ? (
                <div className="grid gap-2 sm:grid-cols-3">
                  <Input
                    label="Desde"
                    type="time"
                    value={rule.start_time}
                    disabled={readOnly}
                    onChange={(e) => updateDayRule(day, { start_time: e.target.value })}
                  />
                  <Input
                    label="Hasta"
                    type="time"
                    value={rule.end_time}
                    disabled={readOnly}
                    onChange={(e) => updateDayRule(day, { end_time: e.target.value })}
                  />
                  <Input
                    label="Min/turno"
                    type="number"
                    min={10}
                    max={120}
                    value={rule.slot_duration}
                    disabled={readOnly}
                    onChange={(e) =>
                      updateDayRule(day, { slot_duration: Number(e.target.value) || 30 })
                    }
                  />
                </div>
              ) : (
                <p className="text-xs text-slate-400 sm:self-center">Sin atención</p>
              )}
            </div>
          );
        })}
      </div>

      {summaryCount > 0 ? (
        <div className="rounded-lg bg-teal-50 px-4 py-3 text-sm text-teal-900">
          <CalendarClock className="mb-1 inline h-4 w-4" /> {summaryCount} día(s) con horario
          configurado
        </div>
      ) : (
        <p className="text-sm text-amber-700">
          Sin horarios cargados: el profesional no tendrá turnos disponibles hasta que definas al
          menos un día.
        </p>
      )}
    </div>
  );
}

export function normalizeAgendaRules(
  rows: Array<{
    day_of_week: number;
    start_time: string;
    end_time: string;
    slot_duration: number;
  }>
): AgendaRuleDraft[] {
  return rows.map((r) => ({
    day_of_week: r.day_of_week,
    start_time: r.start_time.slice(0, 5),
    end_time: r.end_time.slice(0, 5),
    slot_duration: r.slot_duration,
  }));
}

export function parseDisplayName(displayName: string | null): { first: string; last: string } {
  if (!displayName) return { first: "", last: "" };
  const idx = displayName.indexOf(",");
  if (idx === -1) return { first: displayName.trim(), last: "" };
  return {
    last: displayName.slice(0, idx).trim(),
    first: displayName.slice(idx + 1).trim(),
  };
}
