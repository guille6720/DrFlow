"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Header } from "@/components/layout/header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { DoctorSetupFields } from "@/components/onboarding/doctor-setup-fields";
import { ProfessionalIntakeSidebar } from "@/components/profesionales/professional-intake-sidebar";
import {
  ProfessionalScheduleEditor,
  normalizeAgendaRules,
  parseDisplayName,
} from "@/components/profesionales/professional-schedule-editor";
import { MEDICAL_SPECIALTIES, SPECIALTY_OTHER_VALUE } from "@/lib/constants/medical-specialties";
import {
  AGENDA_PRESETS,
  PROFESSIONAL_INTAKE_SECTIONS,
  type AgendaRuleDraft,
} from "@/lib/constants/professional-intake-checklist";
import {
  saveProfessionalSchedule,
  submitProfessionalIntake,
  updateProfessionalProfile,
} from "@/lib/actions/professional-intake";
import type { Clinic, UserRole } from "@/types/database";
import {
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ClipboardList,
  ExternalLink,
  UserPlus,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";

export type ProfessionalIntakeDetail = {
  id: string;
  display_name: string | null;
  document_number?: string | null;
  email?: string | null;
  phone?: string | null;
  license_national?: string | null;
  license_provincial?: string | null;
  office_phone?: string | null;
  office_address?: string | null;
  accepted_insurances?: string | null;
  intake_notes?: string | null;
  intake_completed_at?: string | null;
  location_id?: string | null;
  specialties?: { name: string } | null;
};

export type AvailabilityRuleRow = {
  id: string;
  professional_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  slot_duration: number;
};

interface Props {
  clinics: { clinic_id: string; clinic?: Clinic }[];
  clinicId: string | null;
  role: UserRole | null;
  userName?: string;
  locations: { id: string; name: string; address: string | null }[];
  professionals: ProfessionalIntakeDetail[];
  scheduleByProfessional: Record<string, AvailabilityRuleRow[]>;
}

type DetailTab = "perfil" | "consultorio" | "horarios";
type NewStep = "ficha" | "consultorio" | "agenda";

const DETAIL_TABS: { id: DetailTab; label: string }[] = [
  { id: "perfil", label: "Perfil" },
  { id: "consultorio", label: "Consultorio" },
  { id: "horarios", label: "Horarios" },
];

const NEW_STEPS: { id: NewStep; label: string }[] = [
  { id: "ficha", label: "1. Ficha" },
  { id: "consultorio", label: "2. Consultorio" },
  { id: "agenda", label: "3. Horarios" },
];

export function ProfessionalIntakeView({
  clinics,
  clinicId,
  role,
  userName,
  locations,
  professionals,
  scheduleByProfessional,
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const selectedId = searchParams.get("id");
  const isNew = searchParams.get("nuevo") === "1" || (!selectedId && professionals.length === 0);

  const selected = useMemo(
    () => professionals.find((p) => p.id === selectedId) ?? null,
    [professionals, selectedId]
  );

  const [detailTab, setDetailTab] = useState<DetailTab>("perfil");
  const [newStep, setNewStep] = useState<NewStep>("ficha");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showReference, setShowReference] = useState(false);
  const [agendaRules, setAgendaRules] = useState<AgendaRuleDraft[]>(
    AGENDA_PRESETS[0].rules.map((r) => ({ ...r }))
  );

  useEffect(() => {
    if (!selected) return;
    const rows = scheduleByProfessional[selected.id] ?? [];
    setAgendaRules(
      rows.length > 0
        ? normalizeAgendaRules(rows)
        : AGENDA_PRESETS[0].rules.map((r) => ({ ...r }))
    );
    setDetailTab("perfil");
    setError(null);
    setSuccess(null);
  }, [selected, scheduleByProfessional]);

  const parsedName = parseDisplayName(selected?.display_name ?? null);
  const specialtyDefault = selected?.specialties?.name ?? "";
  const specialtyInList = MEDICAL_SPECIALTIES.includes(
    specialtyDefault as (typeof MEDICAL_SPECIALTIES)[number]
  );

  function navigateTo(id: string | null, nuevo = false) {
    const params = new URLSearchParams();
    if (nuevo) params.set("nuevo", "1");
    else if (id) params.set("id", id);
    const qs = params.toString();
    router.push(qs ? `/ingreso-profesionales?${qs}` : "/ingreso-profesionales");
  }

  function clearError(name: string) {
    setFieldErrors((prev) => {
      if (!prev[name]) return prev;
      const next = { ...prev };
      delete next[name];
      return next;
    });
  }

  async function handleCreateSubmit(e: React.FormEvent<HTMLFormElement>) {
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
    if (result.professionalId) navigateTo(result.professionalId);
    else router.refresh();
  }

  async function handleUpdateProfile(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!selected) return;
    setLoading(true);
    setError(null);
    setSuccess(null);

    const result = await updateProfessionalProfile(selected.id, new FormData(e.currentTarget));
    setLoading(false);

    if (result.error) {
      setError(result.error);
      return;
    }

    setSuccess(result.message ?? "Datos actualizados.");
    router.refresh();
  }

  async function handleSaveSchedule() {
    if (!selected) return;
    setLoading(true);
    setError(null);
    setSuccess(null);

    const formData = new FormData();
    formData.set("agenda_rules_json", JSON.stringify(agendaRules));
    const result = await saveProfessionalSchedule(selected.id, formData);
    setLoading(false);

    if (result.error) {
      setError(result.error);
      return;
    }

    setSuccess(result.message ?? "Horarios guardados.");
    router.refresh();
  }

  const newStepIndex = NEW_STEPS.findIndex((s) => s.id === newStep);

  return (
    <>
      <Header
        title="Ingreso de profesionales"
        subtitle="Alta, perfil, consultorio y rangos horarios del equipo médico"
        clinics={clinics}
        activeClinicId={clinicId}
        role={role}
        userName={userName}
      />

      <div className="flex flex-col gap-4 p-4 lg:flex-row lg:gap-6 lg:p-6">
        <ProfessionalIntakeSidebar
          professionals={professionals}
          selectedId={selectedId}
          isNew={isNew}
          onSelect={(id) => navigateTo(id)}
          onNew={() => {
            setNewStep("ficha");
            setAgendaRules(AGENDA_PRESETS[0].rules.map((r) => ({ ...r })));
            navigateTo(null, true);
          }}
        />

        <div className="min-w-0 flex-1 space-y-4">
          {isNew ? (
            <Card title="Alta de profesional" className="border-teal-100">
              <div className="mb-6 flex flex-wrap gap-2 border-b border-slate-100 pb-4">
                {NEW_STEPS.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setNewStep(s.id)}
                    className={cn(
                      "rounded-full px-4 py-1.5 text-sm font-medium transition",
                      newStep === s.id
                        ? "bg-teal-600 text-white shadow-sm"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    )}
                  >
                    {s.label}
                  </button>
                ))}
              </div>

              <form onSubmit={handleCreateSubmit} className="space-y-6">
                {newStep === "ficha" && (
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

                {newStep === "consultorio" && (
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

                {newStep === "agenda" && (
                  <ProfessionalScheduleEditor rules={agendaRules} onChange={setAgendaRules} />
                )}

                {error ? <p className="text-sm text-red-600">{error}</p> : null}
                {success ? (
                  <p className="flex items-center gap-2 text-sm text-emerald-700">
                    <CheckCircle2 className="h-4 w-4" />
                    {success}
                  </p>
                ) : null}

                <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-4">
                  {newStepIndex > 0 ? (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setNewStep(NEW_STEPS[newStepIndex - 1].id)}
                    >
                      Anterior
                    </Button>
                  ) : null}
                  {newStepIndex < NEW_STEPS.length - 1 ? (
                    <Button type="button" onClick={() => setNewStep(NEW_STEPS[newStepIndex + 1].id)}>
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
          ) : selected ? (
            <>
              <div className="drflow-card-light rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="text-xl font-semibold text-slate-900">
                      {selected.display_name ?? "Profesional"}
                    </h2>
                    <p className="text-sm text-slate-500">
                      {selected.specialties?.name ?? "Sin especialidad"}
                      {selected.license_national ? ` · MN ${selected.license_national}` : ""}
                    </p>
                  </div>
                  {selected.intake_completed_at ? (
                    <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
                      Ficha completa
                    </span>
                  ) : (
                    <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700">
                      Alta parcial
                    </span>
                  )}
                </div>

                <div className="mt-4 flex flex-wrap gap-1 border-b border-slate-100 pb-1">
                  {DETAIL_TABS.map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setDetailTab(tab.id)}
                      className={cn(
                        "rounded-t-lg px-4 py-2 text-sm font-semibold transition",
                        detailTab === tab.id
                          ? "border-b-2 border-teal-500 text-teal-800"
                          : "text-slate-500 hover:text-slate-800"
                      )}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>

              {detailTab === "horarios" ? (
                <Card title="Rangos horarios de atención">
                  <ProfessionalScheduleEditor rules={agendaRules} onChange={setAgendaRules} />
                  {error ? <p className="mt-4 text-sm text-red-600">{error}</p> : null}
                  {success ? (
                    <p className="mt-4 flex items-center gap-2 text-sm text-emerald-700">
                      <CheckCircle2 className="h-4 w-4" />
                      {success}
                    </p>
                  ) : null}
                  <div className="mt-6 flex flex-wrap gap-2 border-t border-slate-100 pt-4">
                    <Button type="button" loading={loading} onClick={handleSaveSchedule}>
                      Guardar horarios
                    </Button>
                    <Link href="/configuracion?grupo=agenda&seccion=agenda">
                      <Button type="button" variant="outline">
                        Agenda avanzada
                      </Button>
                    </Link>
                  </div>
                </Card>
              ) : (
                <Card
                  title={detailTab === "perfil" ? "Perfil del profesional" : "Consultorio y coberturas"}
                >
                  <form onSubmit={handleUpdateProfile} className="space-y-4">
                    {detailTab === "perfil" ? (
                      <>
                        <DoctorSetupFields
                          fieldErrors={fieldErrors}
                          onClearError={clearError}
                          showSectionTitle={false}
                          defaultValues={{
                            doctorFirstName: parsedName.first,
                            doctorLastName: parsedName.last,
                            documentNumber: selected.document_number ?? "",
                            phone: selected.phone ?? "",
                            specialtySelect: specialtyInList
                              ? specialtyDefault
                              : specialtyDefault
                                ? SPECIALTY_OTHER_VALUE
                                : "",
                            specialtyCustom: specialtyInList ? "" : specialtyDefault,
                            licenseNational: selected.license_national ?? "",
                            licenseProvincial: selected.license_provincial ?? "",
                          }}
                        />
                        <Input
                          name="email"
                          label="Email profesional"
                          type="email"
                          defaultValue={selected.email ?? ""}
                          placeholder="medico@consultorio.com"
                        />
                      </>
                    ) : (
                      <>
                        <Select
                          name="location_id"
                          label="Sede existente (opcional)"
                          placeholder="Crear sede nueva con el domicilio"
                          defaultValue={selected.location_id ?? ""}
                          options={locations.map((l) => ({
                            value: l.id,
                            label: l.address ? `${l.name} — ${l.address}` : l.name,
                          }))}
                        />
                        <Input
                          name="officeAddress"
                          label="Domicilio del consultorio"
                          defaultValue={selected.office_address ?? ""}
                          placeholder="Calle, número, localidad"
                        />
                        <Input
                          name="officePhone"
                          label="Teléfono del consultorio"
                          type="tel"
                          defaultValue={selected.office_phone ?? ""}
                          placeholder="11 4567-8900"
                        />
                        <Textarea
                          name="acceptedInsurances"
                          label="Obras sociales / prepagas a atender"
                          defaultValue={selected.accepted_insurances ?? ""}
                          placeholder="PAMI, OSDE, Swiss Medical, IOMA…"
                          rows={3}
                        />
                        <Textarea
                          name="intakeNotes"
                          label="Notas de ingreso / documentación pendiente"
                          defaultValue={selected.intake_notes ?? ""}
                          rows={3}
                        />
                      </>
                    )}

                    {error ? <p className="text-sm text-red-600">{error}</p> : null}
                    {success ? (
                      <p className="flex items-center gap-2 text-sm text-emerald-700">
                        <CheckCircle2 className="h-4 w-4" />
                        {success}
                      </p>
                    ) : null}

                    <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-4">
                      <Button type="submit" loading={loading}>
                        Guardar cambios
                      </Button>
                      <Link href="/configuracion?grupo=consultorio&seccion=equipo">
                        <Button type="button" variant="outline">
                          Invitar al equipo
                        </Button>
                      </Link>
                    </div>
                  </form>
                </Card>
              )}
            </>
          ) : (
            <Card title="Seleccioná un profesional">
              <p className="text-sm text-slate-600">
                Elegí un profesional del panel izquierdo para editar su perfil, consultorio u
                horarios, o creá uno nuevo.
              </p>
            </Card>
          )}

          <Card title="Checklist de ingreso (Argentina)" className="border-slate-200">
            <p className="mb-3 text-xs text-slate-600">
              Referencia de campos habituales en fichas de médicos (colegios, obras sociales y MSAL).
              DrFlow registra lo esencial; el resto queda como guía.
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
              <div className="max-h-80 space-y-4 overflow-y-auto text-xs">
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
        </div>
      </div>
    </>
  );
}
