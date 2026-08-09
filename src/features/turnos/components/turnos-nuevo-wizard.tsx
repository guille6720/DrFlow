"use client";

import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import {
  CalendarCheck,
  CalendarClock,
  Loader2,
  RotateCcw,
  XCircle,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState } from "react";

import { toast } from "@/core/notifications/toast";
import type { AppointmentAgendaRow, ProfessionalAgendaRow } from "@/core/supabase/query-types";

import { CancelAppointmentDialog } from "@/features/agenda/components/agenda/cancel-appointment-dialog";
import { RescheduleAppointmentDialog } from "@/features/agenda/components/agenda/reschedule-appointment-dialog";
import { useAppointmentRow } from "@/features/agenda/hooks/use-appointment-row";
import { PatientSearchCombobox } from "@/features/pacientes/components/pacientes/patient-search-combobox";
import { buildCreatePatientHref } from "@/features/pacientes/utils/create-patient-from-search";
import { createTurnoWizard } from "@/features/turnos/actions/create-turno-wizard";
import { fetchTurnosWizardSlots } from "@/features/turnos/actions/fetch-turnos-wizard-slots";
import { resolveAppointmentLifecycleLabel } from "@/features/turnos/utils/appointment-lifecycle";

import { Badge } from "@/components/ui/badge";
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

function getPatientName(appointment: AppointmentAgendaRow): string {
  const patient = appointment.patients as { first_name: string; last_name: string } | undefined;
  if (!patient) return "Paciente";
  return `${patient.last_name}, ${patient.first_name}`;
}

function ExistingAppointmentActions({
  appointment,
  appointments,
  scheduleBlocks,
  defaultDuration,
  onUpdated,
}: {
  appointment: AppointmentAgendaRow;
  appointments: AppointmentAgendaRow[];
  scheduleBlocks: { start_at: string; end_at: string; reason: string | null }[];
  defaultDuration: number;
  onUpdated: () => void;
}) {
  const row = useAppointmentRow(appointment);
  const [rescheduleOpen, setRescheduleOpen] = useState(false);
  const canModify = appointment.status === "pending" || appointment.status === "confirmed";

  return (
    <>
      <dl className="space-y-2 text-sm">
        <div>
          <dt className="text-[var(--muted-foreground)]">Paciente</dt>
          <dd className="font-medium">{getPatientName(appointment)}</dd>
        </div>
        <div>
          <dt className="text-[var(--muted-foreground)]">Horario</dt>
          <dd className="font-medium">
            {format(parseISO(appointment.start_at), "EEE d MMM · HH:mm 'hs'", { locale: es })}
          </dd>
        </div>
        <div>
          <dt className="text-[var(--muted-foreground)]">Estado</dt>
          <dd>
            <Badge variant={appointment.status === "confirmed" ? "success" : "warning"}>
              {resolveAppointmentLifecycleLabel({
                status: appointment.status,
                waitingRoomStatus: appointment.waiting_room_status,
                isOverbooking: appointment.is_overbooking ?? undefined,
                rescheduledAt: appointment.rescheduled_at,
              })}
            </Badge>
          </dd>
        </div>
      </dl>

      {canModify ? (
        <div className="mt-4 space-y-2">
          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={() => setRescheduleOpen(true)}
          >
            <CalendarClock className="mr-1 h-4 w-4" />
            Reprogramar turno
          </Button>
          <Button
            type="button"
            variant="outline"
            className="w-full border-red-200 text-red-700 hover:bg-red-50"
            onClick={row.openCancelDialog}
            disabled={row.acting}
          >
            <XCircle className="mr-1 h-4 w-4" />
            Cancelar turno
          </Button>
        </div>
      ) : (
        <p className="mt-3 text-sm text-[var(--muted-foreground)]">
          Este turno ya no admite reprogramación ni cancelación desde acá.
        </p>
      )}

      <RescheduleAppointmentDialog
        appointment={appointment}
        appointments={appointments}
        scheduleBlocks={scheduleBlocks}
        defaultDuration={defaultDuration}
        open={rescheduleOpen}
        onClose={() => setRescheduleOpen(false)}
        onSaved={() => {
          toast.success("Turno reprogramado");
          onUpdated();
        }}
      />

      <CancelAppointmentDialog
        open={row.cancelOpen}
        onClose={row.closeCancelDialog}
        onConfirm={async (input) => {
          await row.handleCancelConfirm(input);
          toast.success("Turno cancelado");
          onUpdated();
        }}
        patientName={getPatientName(appointment)}
        loading={row.acting}
      />
    </>
  );
}

export function TurnosNuevoWizard({
  patients,
  professionals,
  locations,
  specialties,
  defaultDuration,
  canOverbook,
}: Props) {
  const router = useRouter();
  const [patientId, setPatientId] = useState("");
  const [selectedPatient, setSelectedPatient] = useState<(typeof patients)[number] | null>(null);
  const [professionalId, setProfessionalId] = useState("");
  const [specialtyId, setSpecialtyId] = useState("");
  const [locationId, setLocationId] = useState("");
  const [slots, setSlots] = useState<Slot[]>([]);
  const [bookedAppointments, setBookedAppointments] = useState<AppointmentAgendaRow[]>([]);
  const [scheduleBlocks, setScheduleBlocks] = useState<
    { start_at: string; end_at: string; reason: string | null }[]
  >([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);
  const [selectedExisting, setSelectedExisting] = useState<AppointmentAgendaRow | null>(null);
  const [modality, setModality] = useState<"presencial" | "virtual">("presencial");
  const [notes, setNotes] = useState("");
  const [priority, setPriority] = useState<"normal" | "high" | "urgent">("normal");
  const [isOverbooking, setIsOverbooking] = useState(false);
  const [overbookingReason, setOverbookingReason] = useState("");
  const [insuranceProvider, setInsuranceProvider] = useState("");
  const [insurancePlan, setInsurancePlan] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isExistingMode = selectedExisting !== null;

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

  const appointmentsByDay = useMemo(() => {
    const map = new Map<string, AppointmentAgendaRow[]>();
    for (const appointment of bookedAppointments) {
      const dayKey = format(parseISO(appointment.start_at), "yyyy-MM-dd");
      const list = map.get(dayKey) ?? [];
      list.push(appointment);
      map.set(dayKey, list);
    }
    return map;
  }, [bookedAppointments]);

  const dayKeys = useMemo(() => {
    const keys = new Set([...slotsByDay.keys(), ...appointmentsByDay.keys()]);
    return [...keys].sort();
  }, [slotsByDay, appointmentsByDay]);

  const loadProfessionalData = useCallback(async (nextProfessionalId: string) => {
    if (!nextProfessionalId) {
      setSlots([]);
      setBookedAppointments([]);
      setScheduleBlocks([]);
      setSelectedDay(null);
      setSelectedSlot(null);
      setSelectedExisting(null);
      return;
    }

    setLoadingSlots(true);
    const result = await fetchTurnosWizardSlots(nextProfessionalId);
    setLoadingSlots(false);

    if (result.error) {
      toast.error(result.error);
      setSlots([]);
      setBookedAppointments([]);
      setScheduleBlocks([]);
      setSelectedDay(null);
      setSelectedSlot(null);
      setSelectedExisting(null);
      return;
    }

    setSlots(result.slots);
    setBookedAppointments(result.appointments);
    setScheduleBlocks(result.scheduleBlocks);
    setSelectedDay(null);
    setSelectedSlot(null);
    setSelectedExisting(null);
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
      const pro = professionals.find((p) => p.id === id);
      if (pro?.specialty_id) setSpecialtyId(pro.specialty_id);
      if (pro?.location_id) setLocationId(pro.location_id);
      void loadProfessionalData(id);
    },
    [loadProfessionalData, professionals]
  );

  const handleSelectFreeSlot = useCallback((slot: Slot) => {
    setSelectedSlot(slot);
    setSelectedExisting(null);
    setError(null);
  }, []);

  const handleSelectExisting = useCallback(
    (appointment: AppointmentAgendaRow) => {
      setSelectedExisting(appointment);
      setSelectedSlot(null);
      setError(null);
      handlePatientChange(appointment.patient_id);
    },
    [handlePatientChange]
  );

  const canConfirm = useMemo(() => {
    if (isExistingMode) return false;
    if (!patientId || !professionalId || !selectedSlot) return false;
    if (isOverbooking && overbookingReason.trim().length === 0) return false;
    return true;
  }, [isExistingMode, patientId, professionalId, selectedSlot, isOverbooking, overbookingReason]);

  const handleClear = useCallback(() => {
    setPatientId("");
    setSelectedPatient(null);
    setSelectedSlot(null);
    setSelectedExisting(null);
    setSelectedDay(null);
    setNotes("");
    setPriority("normal");
    setModality("presencial");
    setIsOverbooking(false);
    setOverbookingReason("");
    setInsuranceProvider("");
    setInsurancePlan("");
    setError(null);
  }, []);

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

  const dayAppointments = selectedDay ? (appointmentsByDay.get(selectedDay) ?? []) : [];
  const daySlots = selectedDay ? (slotsByDay.get(selectedDay) ?? []) : [];

  return (
    <div className="mx-auto max-w-[1600px] space-y-4">
      <div>
        <h1 className="text-xl font-bold">Nuevo turno</h1>
        <p className="text-sm text-[var(--muted-foreground)]">
          Elegí profesional, paciente y horario. Gestioná turnos existentes desde el panel de acciones.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-12 lg:items-start">
        <div className="flex flex-col gap-4 lg:col-span-3">
          <Card title="1 · Profesional">
            <div className="space-y-3">
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
                options={[
                  { value: "", label: "Seleccioná…" },
                  ...filteredProfessionals.map((p) => ({
                    value: p.id,
                    label: getProfessionalDisplayName(p),
                  })),
                ]}
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

          <Card title="2 · Paciente" className="min-h-[280px]">
            <PatientSearchCombobox
              patients={patients}
              searchMode="remote"
              minSearchLength={1}
              displayMode="detailed"
              required={!isExistingMode}
              defaultPatientId={patientId}
              onPatientChange={handlePatientChange}
              createPatientHref={(q) => buildCreatePatientHref(q, "/turnos/nuevo")}
            />
            {selectedPatient ? (
              <dl className="mt-4 space-y-1 rounded-lg bg-[var(--muted)]/40 p-3 text-sm">
                <div className="flex justify-between gap-2">
                  <dt className="text-[var(--muted-foreground)]">DNI</dt>
                  <dd>{selectedPatient.document_number ?? "—"}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-[var(--muted-foreground)]">Obra social</dt>
                  <dd>{selectedPatient.insurance_provider ?? "Particular"}</dd>
                </div>
              </dl>
            ) : null}
          </Card>
        </div>

        <Card title="3 · Horarios" className="lg:col-span-6 lg:min-h-[560px]">
          {!professionalId ? (
            <p className="text-sm text-[var(--muted-foreground)]">
              Seleccioná un profesional para ver la disponibilidad.
            </p>
          ) : loadingSlots ? (
            <p className="flex items-center gap-2 text-sm text-[var(--muted-foreground)]">
              <Loader2 className="h-4 w-4 animate-spin" /> Cargando disponibilidad…
            </p>
          ) : dayKeys.length === 0 ? (
            <p className="text-sm text-[var(--muted-foreground)]">
              No hay horarios ni turnos agendados para este profesional en las próximas semanas.
            </p>
          ) : (
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2">
                {dayKeys.map((dayKey) => {
                  const date = parseISO(`${dayKey}T12:00:00`);
                  const freeCount = slotsByDay.get(dayKey)?.length ?? 0;
                  const bookedCount = appointmentsByDay.get(dayKey)?.length ?? 0;
                  return (
                    <button
                      key={dayKey}
                      type="button"
                      onClick={() => {
                        setSelectedDay(dayKey);
                        setSelectedSlot(null);
                        setSelectedExisting(null);
                      }}
                      className={`rounded-md border px-3 py-2 text-sm transition-colors ${
                        selectedDay === dayKey
                          ? "border-[var(--primary)] bg-[var(--primary)]/10 font-semibold"
                          : "hover:border-[var(--primary)]"
                      }`}
                    >
                      {format(date, "EEE d MMM", { locale: es })}
                      <span className="ml-1 text-xs text-[var(--muted-foreground)]">
                        ({freeCount} libres · {bookedCount} agendados)
                      </span>
                    </button>
                  );
                })}
              </div>

              {selectedDay ? (
                <div className="max-h-[460px] space-y-4 overflow-y-auto">
                  {dayAppointments.length > 0 ? (
                    <div>
                      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
                        Agendados
                      </p>
                      <div className="grid gap-2 sm:grid-cols-2">
                        {dayAppointments.map((appointment) => (
                          <button
                            key={appointment.id}
                            type="button"
                            onClick={() => handleSelectExisting(appointment)}
                            className={`rounded-md border px-3 py-2 text-left text-sm transition-colors ${
                              selectedExisting?.id === appointment.id
                                ? "border-orange-500 bg-orange-50 font-semibold ring-1 ring-orange-500"
                                : "border-orange-200 bg-orange-50/60 hover:border-orange-400"
                            }`}
                          >
                            <span className="font-medium">
                              {format(parseISO(appointment.start_at), "HH:mm", { locale: es })} hs
                            </span>
                            <span className="block truncate text-xs text-slate-700">
                              {getPatientName(appointment)}
                            </span>
                            <span className="block text-xs text-[var(--muted-foreground)]">
                              {resolveAppointmentLifecycleLabel({
                                status: appointment.status,
                                waitingRoomStatus: appointment.waiting_room_status,
                                isOverbooking: appointment.is_overbooking ?? undefined,
                                rescheduledAt: appointment.rescheduled_at,
                              })}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {daySlots.length > 0 ? (
                    <div>
                      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
                        Disponibles
                      </p>
                      <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-4">
                        {daySlots.map((slot) => (
                          <button
                            key={slot.start_at}
                            type="button"
                            onClick={() => handleSelectFreeSlot(slot)}
                            className={`rounded-md border px-3 py-2 text-left text-sm transition-colors ${
                              selectedSlot?.start_at === slot.start_at
                                ? "border-[var(--primary)] bg-[var(--primary)]/10 font-semibold ring-1 ring-[var(--primary)]"
                                : "hover:border-[var(--primary)]"
                            }`}
                          >
                            {format(parseISO(slot.start_at), "HH:mm", { locale: es })} hs
                            <span className="block text-xs text-[var(--muted-foreground)]">
                              {defaultDuration} min
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : dayAppointments.length === 0 ? (
                    <p className="text-sm text-[var(--muted-foreground)]">
                      No hay horarios libres ni turnos este día.
                    </p>
                  ) : (
                    <p className="text-sm text-[var(--muted-foreground)]">
                      No quedan horarios libres este día.
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-sm text-[var(--muted-foreground)]">Elegí un día para ver los horarios.</p>
              )}
            </div>
          )}
        </Card>

        <div className="flex flex-col gap-4 lg:col-span-3">
          <Card title={isExistingMode ? "4 · Turno existente" : "4 · Confirmación"} className="lg:sticky lg:top-4">
            {isExistingMode && selectedExisting ? (
              <ExistingAppointmentActions
                appointment={selectedExisting}
                appointments={bookedAppointments}
                scheduleBlocks={scheduleBlocks}
                defaultDuration={defaultDuration}
                onUpdated={() => void loadProfessionalData(professionalId)}
              />
            ) : (
              <>
                <dl className="space-y-2 text-sm">
                  <div>
                    <dt className="text-[var(--muted-foreground)]">Profesional</dt>
                    <dd className="font-medium">
                      {professional ? getProfessionalDisplayName(professional) : "—"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[var(--muted-foreground)]">Paciente</dt>
                    <dd className="font-medium">
                      {selectedPatient
                        ? `${selectedPatient.last_name}, ${selectedPatient.first_name}`
                        : "—"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[var(--muted-foreground)]">Horario</dt>
                    <dd className="font-medium">
                      {selectedSlot
                        ? format(parseISO(selectedSlot.start_at), "EEE d MMM · HH:mm 'hs'", { locale: es })
                        : "—"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[var(--muted-foreground)]">Especialidad / Consultorio</dt>
                    <dd>
                      {specialty?.name ?? "—"}
                      {location ? ` · ${location.name}` : ""}
                    </dd>
                  </div>
                </dl>

                {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}

                <Button
                  type="button"
                  className="mt-4 w-full"
                  disabled={!canConfirm || submitting}
                  onClick={() => void handleConfirm()}
                >
                  {submitting ? (
                    <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                  ) : (
                    <CalendarCheck className="mr-1 h-4 w-4" />
                  )}
                  Confirmar turno
                </Button>
              </>
            )}
          </Card>

          {!isExistingMode ? (
            <Card title="Modificación">
              <div className="space-y-3">
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
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
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
                <Textarea
                  label="Observaciones / motivo"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                />
                {canOverbook ? (
                  <div className="space-y-2 rounded-md border border-fuchsia-300 bg-fuchsia-50 p-3">
                    <label className="flex items-center gap-2 text-sm font-medium text-fuchsia-900">
                      <input
                        type="checkbox"
                        checked={isOverbooking}
                        onChange={(e) => setIsOverbooking(e.target.checked)}
                      />
                      Sobreturno
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
              </div>
            </Card>
          ) : null}

          <Card title="Cancelación">
            <p className="mb-3 text-sm text-[var(--muted-foreground)]">
              {isExistingMode
                ? "Usá el botón de cancelar turno arriba, o limpiá la selección."
                : "Limpiá la selección actual para empezar de nuevo."}
            </p>
            <Button
              type="button"
              variant="outline"
              className="w-full border-red-200 text-red-700 hover:bg-red-50"
              onClick={handleClear}
              disabled={
                submitting ||
                (!patientId && !selectedSlot && !selectedExisting && !professionalId)
              }
            >
              <RotateCcw className="mr-1 h-4 w-4" />
              Limpiar selección
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="mt-2 w-full text-[var(--muted-foreground)]"
              onClick={() => router.push("/turnos/agenda")}
            >
              <XCircle className="mr-1 h-4 w-4" />
              Volver a agenda
            </Button>
          </Card>
        </div>
      </div>
    </div>
  );
}
