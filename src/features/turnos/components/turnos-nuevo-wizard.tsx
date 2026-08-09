"use client";

import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { ArrowLeft, ArrowRight, CalendarCheck, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState } from "react";

import { toast } from "@/core/notifications/toast";
import type { ProfessionalAgendaRow } from "@/core/supabase/query-types";

import { PatientSearchCombobox } from "@/features/pacientes/components/pacientes/patient-search-combobox";
import { buildCreatePatientHref } from "@/features/pacientes/utils/create-patient-from-search";
import { createTurnoWizard } from "@/features/turnos/actions/create-turno-wizard";
import { fetchTurnosWizardSlots } from "@/features/turnos/actions/fetch-turnos-wizard-slots";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { getProfessionalDisplayName } from "@/lib/utils/professional";
import type { Patient } from "@/types/database";

type Slot = { start_at: string; end_at: string; label: string };

type Props = {
  patients: Pick<Patient, "id" | "first_name" | "last_name" | "document_number" | "insurance_provider" | "insurance_plan">[];
  professionals: ProfessionalAgendaRow[];
  locations: { id: string; name: string }[];
  specialties: { id: string; name: string }[];
  defaultDuration: number;
  canOverbook: boolean;
};

const STEPS = ["Paciente", "Profesional", "Horario", "Detalles", "Confirmar"] as const;

export function TurnosNuevoWizard({
  patients,
  professionals,
  locations,
  specialties,
  defaultDuration,
  canOverbook,
}: Props) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [patientId, setPatientId] = useState("");
  const [selectedPatient, setSelectedPatient] = useState<(typeof patients)[number] | null>(null);
  const [professionalId, setProfessionalId] = useState("");
  const [specialtyId, setSpecialtyId] = useState("");
  const [locationId, setLocationId] = useState("");
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);
  const [modality, setModality] = useState<"presencial" | "virtual">("presencial");
  const [notes, setNotes] = useState("");
  const [priority, setPriority] = useState<"normal" | "high" | "urgent">("normal");
  const [isOverbooking, setIsOverbooking] = useState(false);
  const [overbookingReason, setOverbookingReason] = useState("");
  const [insuranceProvider, setInsuranceProvider] = useState("");
  const [insurancePlan, setInsurancePlan] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filteredProfessionals = useMemo(() => {
    if (!specialtyId) return professionals;
    return professionals.filter((p) => p.specialty_id === specialtyId);
  }, [professionals, specialtyId]);

  const slotsByDay = useMemo(() => {
    const map = new Map<string, Slot[]>();
    for (const slot of slots) {
      const dayKey = format(parseISO(slot.start_at), "yyyy-MM-dd");
      const list = map.get(dayKey) ?? [];
      list.push(slot);
      map.set(dayKey, list);
    }
    return map;
  }, [slots]);

  const dayKeys = useMemo(() => [...slotsByDay.keys()].sort(), [slotsByDay]);

  const loadProfessionalSlots = useCallback(async (nextProfessionalId: string) => {
    if (!nextProfessionalId) {
      setSlots([]);
      setSelectedDay(null);
      setSelectedSlot(null);
      return;
    }

    setLoadingSlots(true);
    const result = await fetchTurnosWizardSlots(nextProfessionalId);
    setLoadingSlots(false);

    if (result.error) {
      toast.error(result.error);
      setSlots([]);
      setSelectedDay(null);
      setSelectedSlot(null);
      return;
    }

    setSlots(result.slots);
    setSelectedDay(null);
    setSelectedSlot(null);
  }, []);

  const handlePatientChange = useCallback(
    (id: string) => {
      setPatientId(id);
      const found = patients.find((p) => p.id === id) ?? null;
      setSelectedPatient(found);
      setInsuranceProvider(found?.insurance_provider ?? "");
      setInsurancePlan(found?.insurance_plan ?? "");
    },
    [patients]
  );

  const handleProfessionalChange = useCallback(
    (id: string) => {
      setProfessionalId(id);
      void loadProfessionalSlots(id);
    },
    [loadProfessionalSlots]
  );

  const canAdvance = useMemo(() => {
    if (step === 0) return patientId.length > 0;
    if (step === 1) return professionalId.length > 0;
    if (step === 2) return selectedSlot !== null;
    if (step === 3) return !isOverbooking || overbookingReason.trim().length > 0;
    return true;
  }, [step, patientId, professionalId, selectedSlot, isOverbooking, overbookingReason]);

  const handleConfirm = useCallback(async () => {
    if (!selectedSlot || !patientId || !professionalId) return;
    setSubmitting(true);
    setError(null);

    const result = await createTurnoWizard({
      patient_id: patientId,
      professional_id: professionalId,
      specialty_id: specialtyId || null,
      location_id: locationId || null,
      start_at: selectedSlot.start_at,
      end_at: selectedSlot.end_at,
      notes: notes || undefined,
      consultation_modality: modality,
      is_overbooking: isOverbooking,
      overbooking_reason: isOverbooking ? overbookingReason : null,
      priority,
      insurance_provider: insuranceProvider || null,
      insurance_plan: insurancePlan || null,
    });

    setSubmitting(false);
    if (result.error) {
      setError(result.error);
      toast.error(result.error);
      return;
    }

    toast.success(isOverbooking ? "Sobreturno confirmado" : "Turno confirmado");
    router.push("/turnos/agenda");
    router.refresh();
  }, [
    selectedSlot,
    patientId,
    professionalId,
    specialtyId,
    locationId,
    notes,
    modality,
    isOverbooking,
    overbookingReason,
    priority,
    insuranceProvider,
    insurancePlan,
    router,
  ]);

  const professional = professionals.find((p) => p.id === professionalId);
  const specialty = specialties.find((s) => s.id === specialtyId);
  const location = locations.find((l) => l.id === locationId);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-xl font-bold">Nuevo turno</h1>
        <p className="text-sm text-[var(--muted-foreground)]">
          Paciente → Profesional → Horario → Confirmar
        </p>
      </div>

      <ol className="flex flex-wrap gap-2 text-xs">
        {STEPS.map((label, index) => (
          <li
            key={label}
            className={`rounded-full px-3 py-1 font-medium ${
              index === step
                ? "bg-[var(--primary)] text-[var(--primary-foreground)]"
                : index < step
                  ? "bg-emerald-100 text-emerald-900"
                  : "bg-[var(--muted)] text-[var(--muted-foreground)]"
            }`}
          >
            {index + 1}. {label}
          </li>
        ))}
      </ol>

      {step === 0 ? (
        <Card title="Buscar paciente">
          <PatientSearchCombobox
            patients={patients}
            searchMode="remote"
            minSearchLength={1}
            displayMode="detailed"
            required
            defaultPatientId={patientId}
            onPatientChange={handlePatientChange}
            createPatientHref={(q) => buildCreatePatientHref(q, "/turnos/nuevo")}
          />
        </Card>
      ) : null}

      {step === 1 ? (
        <Card title="Profesional y especialidad">
          <div className="grid gap-4 sm:grid-cols-2">
            <Select
              label="Especialidad"
              value={specialtyId}
              onChange={(e) => {
                setSpecialtyId(e.target.value);
                handleProfessionalChange("");
              }}
              options={[
                { value: "", label: "Todas" },
                ...specialties.map((s) => ({ value: s.id, label: s.name })),
              ]}
            />
            <Select
              label="Profesional"
              required
              value={professionalId}
              onChange={(e) => handleProfessionalChange(e.target.value)}
              options={filteredProfessionals.map((p) => ({
                value: p.id,
                label: getProfessionalDisplayName(p),
              }))}
            />
            <Select
              label="Consultorio"
              value={locationId}
              onChange={(e) => setLocationId(e.target.value)}
              options={[
                { value: "", label: "Sin especificar" },
                ...locations.map((l) => ({ value: l.id, label: l.name })),
              ]}
            />
          </div>
        </Card>
      ) : null}

      {step === 2 ? (
        <Card title="Elegir día y horario">
          {loadingSlots ? (
            <p className="flex items-center gap-2 text-sm text-[var(--muted-foreground)]">
              <Loader2 className="h-4 w-4 animate-spin" /> Cargando disponibilidad…
            </p>
          ) : dayKeys.length === 0 ? (
            <p className="text-sm text-[var(--muted-foreground)]">
              No hay horarios disponibles para este profesional en las próximas semanas.
            </p>
          ) : (
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2">
                {dayKeys.map((dayKey) => {
                  const date = parseISO(`${dayKey}T12:00:00`);
                  const disabled = (slotsByDay.get(dayKey)?.length ?? 0) === 0;
                  return (
                    <button
                      key={dayKey}
                      type="button"
                      disabled={disabled}
                      onClick={() => {
                        setSelectedDay(dayKey);
                        setSelectedSlot(null);
                      }}
                      className={`rounded-md border px-3 py-2 text-sm ${
                        selectedDay === dayKey
                          ? "border-[var(--primary)] bg-[var(--primary)]/10 font-semibold"
                          : disabled
                            ? "opacity-40"
                            : "hover:border-[var(--primary)]"
                      }`}
                    >
                      {format(date, "EEE d MMM", { locale: es })}
                    </button>
                  );
                })}
              </div>

              {selectedDay ? (
                <div className="grid gap-2 sm:grid-cols-3">
                  {(slotsByDay.get(selectedDay) ?? []).map((slot) => (
                    <button
                      key={slot.start_at}
                      type="button"
                      onClick={() => setSelectedSlot(slot)}
                      className={`rounded-md border px-3 py-2 text-left text-sm ${
                        selectedSlot?.start_at === slot.start_at
                          ? "border-[var(--primary)] bg-[var(--primary)]/10 font-semibold"
                          : "hover:border-[var(--primary)]"
                      }`}
                    >
                      {format(parseISO(slot.start_at), "HH:mm", { locale: es })} hs
                      <span className="block text-xs text-[var(--muted-foreground)]">
                        {defaultDuration} min · {modality === "virtual" ? "Virtual" : "Presencial"}
                      </span>
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          )}
        </Card>
      ) : null}

      {step === 3 ? (
        <Card title="Datos adicionales">
          <div className="grid gap-4 sm:grid-cols-2">
            <Select
              label="Tipo de atención"
              value={modality}
              onChange={(e) => setModality(e.target.value as "presencial" | "virtual")}
              options={[
                { value: "presencial", label: "Presencial" },
                { value: "virtual", label: "Virtual" },
              ]}
            />
            <Select
              label="Prioridad"
              value={priority}
              onChange={(e) => setPriority(e.target.value as typeof priority)}
              options={[
                { value: "normal", label: "Normal" },
                { value: "high", label: "Alta" },
                { value: "urgent", label: "Urgente" },
              ]}
            />
            <Input
              label="Obra social"
              value={insuranceProvider}
              onChange={(e) => setInsuranceProvider(e.target.value)}
            />
            <Input
              label="Plan"
              value={insurancePlan}
              onChange={(e) => setInsurancePlan(e.target.value)}
            />
          </div>
          <div className="mt-4">
            <Textarea
              label="Observaciones / motivo"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
            />
          </div>
          {canOverbook ? (
            <div className="mt-4 space-y-2 rounded-md border border-fuchsia-300 bg-fuchsia-50 p-3">
              <label className="flex items-center gap-2 text-sm font-medium text-fuchsia-900">
                <input
                  type="checkbox"
                  checked={isOverbooking}
                  onChange={(e) => setIsOverbooking(e.target.checked)}
                />
                Sobreturno (fuera de cupo)
              </label>
              {isOverbooking ? (
                <Textarea
                  label="Motivo del sobreturno"
                  required
                  value={overbookingReason}
                  onChange={(e) => setOverbookingReason(e.target.value)}
                  rows={2}
                />
              ) : null}
            </div>
          ) : null}
        </Card>
      ) : null}

      {step === 4 ? (
        <Card title="Confirmación">
          <dl className="grid gap-2 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-[var(--muted-foreground)]">Paciente</dt>
              <dd className="font-medium">
                {selectedPatient
                  ? `${selectedPatient.last_name}, ${selectedPatient.first_name}`
                  : "—"}
              </dd>
            </div>
            <div>
              <dt className="text-[var(--muted-foreground)]">Profesional</dt>
              <dd className="font-medium">
                {professional ? getProfessionalDisplayName(professional) : "—"}
              </dd>
            </div>
            <div>
              <dt className="text-[var(--muted-foreground)]">Especialidad</dt>
              <dd>{specialty?.name ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-[var(--muted-foreground)]">Consultorio</dt>
              <dd>{location?.name ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-[var(--muted-foreground)]">Fecha y hora</dt>
              <dd className="font-medium">
                {selectedSlot
                  ? format(parseISO(selectedSlot.start_at), "EEEE d MMMM yyyy · HH:mm 'hs'", {
                      locale: es,
                    })
                  : "—"}
              </dd>
            </div>
            <div>
              <dt className="text-[var(--muted-foreground)]">Modalidad</dt>
              <dd>{modality === "virtual" ? "Virtual" : "Presencial"}</dd>
            </div>
            <div>
              <dt className="text-[var(--muted-foreground)]">Obra social</dt>
              <dd>{insuranceProvider || "Particular"}</dd>
            </div>
            {isOverbooking ? (
              <div className="sm:col-span-2 rounded-md bg-fuchsia-100 px-3 py-2 font-medium text-fuchsia-900">
                Sobreturno — {overbookingReason}
              </div>
            ) : null}
          </dl>
          {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
        </Card>
      ) : null}

      <div className="flex flex-wrap justify-between gap-3">
        <Button
          type="button"
          variant="outline"
          disabled={step === 0 || submitting}
          onClick={() => setStep((s) => Math.max(0, s - 1))}
        >
          <ArrowLeft className="mr-1 h-4 w-4" /> Anterior
        </Button>

        {step < STEPS.length - 1 ? (
          <Button
            type="button"
            disabled={!canAdvance}
            onClick={() => setStep((s) => s + 1)}
          >
            Siguiente <ArrowRight className="ml-1 h-4 w-4" />
          </Button>
        ) : (
          <Button type="button" disabled={submitting || !canAdvance} onClick={() => void handleConfirm()}>
            {submitting ? (
              <Loader2 className="mr-1 h-4 w-4 animate-spin" />
            ) : (
              <CalendarCheck className="mr-1 h-4 w-4" />
            )}
            Confirmar turno
          </Button>
        )}
      </div>
    </div>
  );
}
