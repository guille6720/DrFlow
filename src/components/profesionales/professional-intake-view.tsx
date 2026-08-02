"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Header } from "@/components/layout/header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { DoctorSetupFields } from "@/components/onboarding/doctor-setup-fields";
import {
  AGENDA_PRESETS,
  PROFESSIONAL_INTAKE_SECTIONS,
  WEEKDAY_LABELS,
  type AgendaRuleDraft,
} from "@/lib/constants/professional-intake-checklist";
import { submitProfessionalIntake } from "@/lib/actions/professional-intake";
import type { Clinic, Professional, UserRole } from "@/types/database";
import {
  CalendarClock,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ClipboardList,
  ExternalLink,
  UserPlus,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";

interface Props {
  clinics: { clinic_id: string; clinic?: Clinic }[];
  clinicId: string | null;
  role: UserRole | null;
  userName?: string;
  locations: { id: string; name: string; address: string | null }[];
  professionals: Professional[];
}

type Step = "ficha" | "consultorio" | "agenda";

const STEPS: { id: Step; label: string }[] = [
  { id: "ficha", label: "1. Ficha médica" },
  { id: "consultorio", label: "2. Consultorio" },
  { id: "agenda", label: "3. Agenda" },
];

function formatProfessional(p: Professional) {
  return p.display_name ?? "Profesional";
}

export function ProfessionalIntakeView({
  clinics,
  clinicId,
  role,
  userName,
  locations,
  professionals,
}: Props) {
  const router = useRouter();
  const [step, setStep] = useState<Step>("ficha");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showReference, setShowReference] = useState(false);
  const [agendaRules, setAgendaRules] = useState<AgendaRuleDraft[]>(
    AGENDA_PRESETS[0].rules.map((r) => ({ ...r }))
  );

  const stepIndex = STEPS.findIndex((s) => s.id === step);

  const agendaSummary = useMemo(() => {
    const byDay = new Map<number, AgendaRuleDraft>();
    for (const rule of agendaRules) byDay.set(rule.day_of_week, rule);
    return Array.from(byDay.entries()).sort(([a], [b]) => a - b);
  }, [agendaRules]);

  function clearError(name: string) {
    setFieldErrors((prev) => {
      if (!prev[name]) return prev;
      const next = { ...prev };
      delete next[name];
      return next;
    });
  }

  function applyPreset(presetId: string) {
    const preset = AGENDA_PRESETS.find((p) => p.id === presetId);
    if (preset) setAgendaRules(preset.rules.map((r) => ({ ...r })));
  }

  function toggleDay(day: number, enabled: boolean) {
    setAgendaRules((prev) => {
      if (enabled) {
        if (prev.some((r) => r.day_of_week === day)) return prev;
        return [
          ...prev,
          { day_of_week: day, start_time: "09:00", end_time: "18:00", slot_duration: 30 },
        ];
      }
      return prev.filter((r) => r.day_of_week !== day);
    });
  }

  function updateDayRule(day: number, patch: Partial<AgendaRuleDraft>) {
    setAgendaRules((prev) =>
      prev.map((r) => (r.day_of_week === day ? { ...r, ...patch } : r))
    );
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    const formData = new FormData(e.currentTarget);
    formData.set("agenda_rules_json", JSON.stringify(agendaRules));

    const result = await submitProfessionalIntake(formData);
    setLoading(false);

    if (result.error) {
      setError(result.error);
      return;
    }

    setSuccess(result.message ?? "Profesional registrado.");
    e.currentTarget.reset();
    setAgendaRules(AGENDA_PRESETS[0].rules.map((r) => ({ ...r })));
    setStep("ficha");
    router.refresh();
  }

  return (
    <>
      <Header
        title="Ingreso de profesionales"
        subtitle="Ficha de alta del médico y creación de agenda inicial"
        clinics={clinics}
        activeClinicId={clinicId}
        role={role}
        userName={userName}
      />

      <div className="space-y-6 p-4 sm:p-6">
        <div className="grid gap-6 xl:grid-cols-[1fr_320px]">
          <div className="space-y-6">
            <Card title="Alta de profesional" className="border-teal-100">
              <div className="mb-6 flex flex-wrap gap-2">
                {STEPS.map((s, i) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setStep(s.id)}
                    className={cn(
                      "rounded-full px-4 py-1.5 text-sm font-medium transition",
                      step === s.id
                        ? "bg-teal-600 text-white shadow-sm"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    )}
                  >
                    {s.label}
                  </button>
                ))}
              </div>

              <form onSubmit={handleSubmit} className="space-y-6">
                {step === "ficha" && (
                  <div className="space-y-4">
                    <DoctorSetupFields
                      fieldErrors={fieldErrors}
                      onClearError={clearError}
                      showSectionTitle={false}
                    />
                    <Input
                      name="email"
                      label="Email profesional"
                      type="email"
                      placeholder="medico@consultorio.com"
                    />
                  </div>
                )}

                {step === "consultorio" && (
                  <div className="space-y-4">
                    <Select
                      name="location_id"
                      label="Sede existente (opcional)"
                      placeholder="Crear sede nueva con el domicilio"
                      options={locations.map((l) => ({
                        value: l.id,
                        label: l.address ? `${l.name} — ${l.address}` : l.name,
                      }))}
                    />
                    <Input
                      name="officeAddress"
                      label="Domicilio del consultorio"
                      placeholder="Calle, número, localidad"
                    />
                    <Input
                      name="officePhone"
                      label="Teléfono del consultorio"
                      type="tel"
                      placeholder="11 4567-8900"
                    />
                    <Textarea
                      name="acceptedInsurances"
                      label="Obras sociales / prepagas a atender"
                      placeholder="PAMI, OSDE, Swiss Medical, IOMA…"
                      rows={3}
                    />
                    <Textarea
                      name="intakeNotes"
                      label="Notas de ingreso / documentación pendiente"
                      placeholder="Ej: pendiente certificado de ética, habilitación colegio…"
                      rows={3}
                    />
                  </div>
                )}

                {step === "agenda" && (
                  <div className="space-y-4">
                    <p className="text-sm text-slate-600">
                      Elegí un modelo de horarios o ajustá día por día. Alimenta turnos online y la
                      agenda interna.
                    </p>

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

                    <div className="space-y-3 rounded-xl border border-slate-200 p-4">
                      {[1, 2, 3, 4, 5, 6, 0].map((day) => {
                        const rule = agendaRules.find((r) => r.day_of_week === day);
                        const enabled = Boolean(rule);
                        return (
                          <div
                            key={day}
                            className="grid gap-3 border-b border-slate-100 pb-3 last:border-0 last:pb-0 sm:grid-cols-[140px_1fr]"
                          >
                            <label className="inline-flex items-center gap-2 text-sm font-medium text-slate-800">
                              <input
                                type="checkbox"
                                checked={enabled}
                                onChange={(e) => toggleDay(day, e.target.checked)}
                                className="h-4 w-4 rounded border-slate-300 text-teal-600"
                              />
                              {WEEKDAY_LABELS[day]}
                            </label>
                            {enabled && rule ? (
                              <div className="grid gap-2 sm:grid-cols-3">
                                <Input
                                  label="Desde"
                                  type="time"
                                  value={rule.start_time}
                                  onChange={(e) =>
                                    updateDayRule(day, { start_time: e.target.value })
                                  }
                                />
                                <Input
                                  label="Hasta"
                                  type="time"
                                  value={rule.end_time}
                                  onChange={(e) =>
                                    updateDayRule(day, { end_time: e.target.value })
                                  }
                                />
                                <Input
                                  label="Min/turno"
                                  type="number"
                                  min={10}
                                  max={120}
                                  value={rule.slot_duration}
                                  onChange={(e) =>
                                    updateDayRule(day, {
                                      slot_duration: Number(e.target.value) || 30,
                                    })
                                  }
                                />
                              </div>
                            ) : (
                              <p className="text-xs text-slate-400 sm:col-span-1 sm:self-center">
                                Sin atención
                              </p>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {agendaSummary.length > 0 ? (
                      <div className="rounded-lg bg-teal-50 px-4 py-3 text-sm text-teal-900">
                        <CalendarClock className="mb-1 inline h-4 w-4" />{" "}
                        {agendaSummary.length} día(s) configurados
                      </div>
                    ) : (
                      <p className="text-sm text-amber-700">
                        Sin horarios: podés guardar igual y cargar la agenda después en Configuración.
                      </p>
                    )}
                  </div>
                )}

                {error ? <p className="text-sm text-red-600">{error}</p> : null}
                {success ? (
                  <p className="flex items-center gap-2 text-sm text-emerald-700">
                    <CheckCircle2 className="h-4 w-4" />
                    {success}
                  </p>
                ) : null}

                <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-4">
                  {stepIndex > 0 ? (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setStep(STEPS[stepIndex - 1].id)}
                    >
                      Anterior
                    </Button>
                  ) : null}
                  {stepIndex < STEPS.length - 1 ? (
                    <Button type="button" onClick={() => setStep(STEPS[stepIndex + 1].id)}>
                      Siguiente
                    </Button>
                  ) : (
                    <Button type="submit" loading={loading}>
                      <UserPlus className="h-4 w-4" />
                      Registrar profesional
                    </Button>
                  )}
                </div>
              </form>
            </Card>

            <Card title="Profesionales registrados">
              {professionals.length === 0 ? (
                <p className="text-sm text-slate-500">Todavía no hay profesionales cargados.</p>
              ) : (
                <ul className="divide-y divide-slate-100 text-sm">
                  {professionals.map((p) => (
                    <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                      <div>
                        <p className="font-medium text-slate-900">{formatProfessional(p)}</p>
                        <p className="text-xs text-slate-500">
                          {p.specialties?.name ?? "Sin especialidad"}
                          {p.license_national ? ` · MN ${p.license_national}` : ""}
                        </p>
                      </div>
                      {p.intake_completed_at ? (
                        <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
                          Ficha completa
                        </span>
                      ) : (
                        <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
                          Alta parcial
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
              <div className="mt-4 flex flex-wrap gap-3 text-sm">
                <Link href="/configuracion?grupo=consultorio&seccion=equipo" className="text-teal-700 hover:underline">
                  Invitar usuario al equipo →
                </Link>
                <Link href="/configuracion?grupo=agenda&seccion=agenda" className="text-teal-700 hover:underline">
                  Ajustar agenda avanzada →
                </Link>
              </div>
            </Card>
          </div>

          <aside className="space-y-4">
            <Card title="Modelos de referencia" className="border-slate-200">
              <p className="mb-3 text-xs text-slate-600">
                Campos habituales en fichas de ingreso de médicos en Argentina (colegios, obras
                sociales y MSAL). DrFlow registra lo esencial; el resto queda como checklist.
              </p>
              <button
                type="button"
                onClick={() => setShowReference(!showReference)}
                className="mb-3 flex w-full items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm font-medium text-slate-800"
              >
                <span className="inline-flex items-center gap-2">
                  <ClipboardList className="h-4 w-4 text-teal-600" />
                  Ver checklist completo
                </span>
                {showReference ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </button>

              {showReference ? (
                <div className="max-h-[480px] space-y-4 overflow-y-auto text-xs">
                  {PROFESSIONAL_INTAKE_SECTIONS.map((section) => (
                    <div key={section.id}>
                      <p className="font-semibold text-slate-900">{section.title}</p>
                      <ul className="mt-2 space-y-1.5 text-slate-600">
                        {section.items.map((item) => (
                          <li key={item.id}>
                            · {item.label}
                            {item.detail ? (
                              <span className="block pl-3 text-slate-500">{item.detail}</span>
                            ) : null}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                  <div className="space-y-2 border-t border-slate-100 pt-3 text-slate-500">
                    <a
                      href="https://www.argentina.gob.ar/servicio/sacar-la-matricula-de-profesional-de-la-salud-con-diploma-en-soporte-papel-y-digital"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-teal-700 hover:underline"
                    >
                      Matrícula nacional (RUPS) <ExternalLink className="h-3 w-3" />
                    </a>
                    <br />
                    <a
                      href="https://www.argentina.gob.ar/servicio/habilitacion-de-un-consultorio-medico"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-teal-700 hover:underline"
                    >
                      Habilitación consultorio CABA <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                </div>
              ) : null}
            </Card>
          </aside>
        </div>
      </div>
    </>
  );
}
