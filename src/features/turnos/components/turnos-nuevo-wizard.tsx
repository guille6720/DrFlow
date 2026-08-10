"use client";

import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import {
  CalendarCheck,
  CalendarClock,
  Clock3,
  Loader2,
  RotateCcw,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";

import { toast } from "@/core/notifications/toast";
import type { AppointmentAgendaRow, ProfessionalAgendaRow } from "@/core/supabase/query-types";

import { cn } from "@/shared/utils/cn";

import { RescheduleAppointmentDialog } from "@/features/agenda/components/agenda/reschedule-appointment-dialog";
import { useAppointmentRow } from "@/features/agenda/hooks/use-appointment-row";
import { PatientSearchCombobox, type PatientSearchOption } from "@/features/pacientes/components/pacientes/patient-search-combobox";
import { buildCreatePatientHref } from "@/features/pacientes/utils/create-patient-from-search";
import { createTurnoWizard } from "@/features/turnos/actions/create-turno-wizard";
import { fetchTurnosWizardSlots } from "@/features/turnos/actions/fetch-turnos-wizard-slots";
import {
  APPOINTMENT_DURATION_OPTIONS,
  DEFAULT_APPOINTMENT_DURATION_MINUTES,
  filterSlotsByDuration,
  resolveAppointmentEndAt,
  slotSupportsDuration,
} from "@/features/turnos/utils/appointment-duration";
import {
  CANCELLATION_REASON_OPTIONS,
  type CancellationCategory,
  resolveAppointmentLifecycleLabel,
} from "@/features/turnos/utils/appointment-lifecycle";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  defaultInsurancePlanForProvider,
  insurancePlanOptionsForProvider,
  insuranceProviderOptions,
} from "@/lib/constants/coverages";
import { getProfessionalDisplayName } from "@/lib/utils/professional";
import type { Patient } from "@/types/database";

type Slot = { start_at: string; end_at: string; label: string };

type Props = {
  patients: Pick<Patient, "id" | "first_name" | "last_name" | "document_number" | "insurance_provider" | "insurance_plan">[];
  initialPatient?: Pick<
    Patient,
    "id" | "first_name" | "last_name" | "document_number" | "insurance_provider" | "insurance_plan"
  > | null;
  professionals: ProfessionalAgendaRow[];
  locations: { id: string; name: string }[];
  specialties: { id: string; name: string }[];
  defaultDuration: number;
  canOverbook: boolean;
  defaultProfessionalId?: string;
  initialStartAt?: string;
  initialWizardSlots?: {
    slots: Slot[];
    appointments: AppointmentAgendaRow[];
    scheduleBlocks: { start_at: string; end_at: string; reason: string | null }[];
  };
};

const LABEL_CLASS = "text-xs font-bold uppercase tracking-wide text-slate-800";
const VALUE_CLASS = "font-semibold text-slate-950";
const MUTED_CLASS = "text-sm font-medium text-slate-700";
const SECTION_HEADING = "mb-2 text-xs font-bold uppercase tracking-wide text-slate-800";
const TURNOS_CARD_CLASS = "turnos-nuevo-card";

function mergePatientSelection(
  id: string,
  fromList?: Props["patients"][number],
  picked?: PatientSearchOption
): Props["patients"][number] | null {
  if (!fromList && !picked) return null;

  return {
    id,
    first_name: picked?.first_name ?? fromList?.first_name ?? "",
    last_name: picked?.last_name ?? fromList?.last_name ?? "",
    document_number: picked?.document_number ?? fromList?.document_number ?? "",
    insurance_provider: picked?.insurance_provider ?? fromList?.insurance_provider ?? null,
    insurance_plan: picked?.insurance_plan ?? fromList?.insurance_plan ?? null,
  };
}
function getPatientName(appointment: AppointmentAgendaRow): string {
  const patient = appointment.patients as { first_name: string; last_name: string } | undefined;
  if (!patient) return "Paciente";
  return `${patient.last_name}, ${patient.first_name}`;
}

function SummaryRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className={LABEL_CLASS}>{label}</dt>
      <dd className={`mt-0.5 ${VALUE_CLASS}`}>{children}</dd>
    </div>
  );
}

function ExistingAppointmentSummary({
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
  const [rescheduleOpen, setRescheduleOpen] = useState(false);
  const canModify = appointment.status === "pending" || appointment.status === "confirmed";

  return (
    <>
      <dl className="space-y-3 text-sm">
        <SummaryRow label="Paciente">{getPatientName(appointment)}</SummaryRow>
        <SummaryRow label="Horario">
          {format(parseISO(appointment.start_at), "EEE d MMM · HH:mm 'hs'", { locale: es })}
        </SummaryRow>
        <SummaryRow label="Estado">
          <Badge variant={appointment.status === "confirmed" ? "success" : "warning"}>
            {resolveAppointmentLifecycleLabel({
              status: appointment.status,
              waitingRoomStatus: appointment.waiting_room_status,
              isOverbooking: appointment.is_overbooking ?? undefined,
              rescheduledAt: appointment.rescheduled_at,
            })}
          </Badge>
        </SummaryRow>
      </dl>

      {canModify ? (
        <Button
          type="button"
          variant="outline"
          className="mt-4 w-full"
          onClick={() => setRescheduleOpen(true)}
        >
          <CalendarClock className="mr-1 h-4 w-4" />
          Reprogramar turno
        </Button>
      ) : (
        <p className={`mt-3 ${MUTED_CLASS}`}>
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
    </>
  );
}

function ExistingAppointmentCancelPanel({
  appointment,
  onCancelled,
}: {
  appointment: AppointmentAgendaRow;
  onCancelled: () => void;
}) {
  const row = useAppointmentRow(appointment);
  const [category, setCategory] = useState<CancellationCategory>("clinic");
  const [detail, setDetail] = useState("");
  const [error, setError] = useState<string | null>(null);

  const canCancel = appointment.status === "pending" || appointment.status === "confirmed";

  if (!canCancel) return null;

  async function handleCancel() {
    const trimmed = detail.trim();
    if (trimmed.length < 3) {
      setError("Indicá el motivo (mín. 3 caracteres)");
      return;
    }
    setError(null);
    const result = await row.handleCancelConfirm({ category, detail: trimmed });
    if (result?.error) {
      setError(result.error);
      toast.error(result.error);
      return;
    }
    toast.success("Turno cancelado");
    setDetail("");
    setCategory("clinic");
    onCancelled();
  }

  return (
    <div className="rounded-xl border border-red-200 bg-red-50/80 p-4">
      <p className="text-sm font-semibold text-red-900">Cancelación</p>
      <p className="mt-1 text-sm text-red-800/90">
        Turno de {getPatientName(appointment)} —{" "}
        {format(parseISO(appointment.start_at), "EEE d MMM · HH:mm 'hs'", { locale: es })}
      </p>
      <div className="mt-3 space-y-3">
        <Select
          label="Motivo"
          required
          value={category}
          onChange={(e) => setCategory(e.target.value as CancellationCategory)}
          options={CANCELLATION_REASON_OPTIONS.map((option) => ({
            value: option.value,
            label: option.label,
          }))}
        />
        <Textarea
          label="Motivo de cancelación"
          required
          value={detail}
          onChange={(e) => {
            setDetail(e.target.value);
            setError(null);
          }}
          placeholder="Ej: El paciente avisó que no puede asistir"
          rows={3}
          error={error ?? undefined}
        />
        <Button
          type="button"
          variant="danger"
          className="w-full"
          loading={row.acting}
          onClick={() => void handleCancel()}
        >
          Confirmar cancelación
        </Button>
      </div>
    </div>
  );
}

function resolveInitialSlotSelection(
  initialStartAt: string | undefined,
  initialWizardSlots: Props["initialWizardSlots"]
): { day: string | null; slot: Slot | null } {
  if (!initialStartAt || !initialWizardSlots?.slots.length) {
    return { day: null, slot: null };
  }

  const targetTime = parseISO(initialStartAt).getTime();
  const slot =
    initialWizardSlots.slots.find((entry) => entry.start_at === initialStartAt) ??
    initialWizardSlots.slots.find(
      (entry) => parseISO(entry.start_at).getTime() === targetTime
    );

  if (!slot) return { day: null, slot: null };

  return {
    day: format(parseISO(slot.start_at), "yyyy-MM-dd"),
    slot,
  };
}

export function TurnosNuevoWizard({
  patients,
  initialPatient,
  professionals,
  locations,
  specialties,
  defaultDuration,
  canOverbook,
  defaultProfessionalId,
  initialStartAt,
  initialWizardSlots,
}: Props) {
  const router = useRouter();
  const patientOptions = useMemo(() => {
    if (!initialPatient) return patients;
    if (patients.some((patient) => patient.id === initialPatient.id)) return patients;
    return [initialPatient, ...patients];
  }, [initialPatient, patients]);

  const defaultProfessional = useMemo(
    () =>
      defaultProfessionalId
        ? professionals.find((professional) => professional.id === defaultProfessionalId)
        : undefined,
    [defaultProfessionalId, professionals]
  );

  const [patientId, setPatientId] = useState(() => initialPatient?.id ?? "");
  const [selectedPatient, setSelectedPatient] = useState<(typeof patientOptions)[number] | null>(
    () => initialPatient ?? null
  );
  const displayedPatient = useMemo(() => {
    if (!patientId) return null;
    if (selectedPatient?.id === patientId) return selectedPatient;
    return patientOptions.find((patient) => patient.id === patientId) ?? selectedPatient;
  }, [patientId, patientOptions, selectedPatient]);
  const [professionalId, setProfessionalId] = useState(() => defaultProfessional?.id ?? "");
  const [specialtyId, setSpecialtyId] = useState(() => defaultProfessional?.specialty_id ?? "");
  const [locationId, setLocationId] = useState(() => defaultProfessional?.location_id ?? "");
  const [slots, setSlots] = useState<Slot[]>(() => initialWizardSlots?.slots ?? []);
  const [bookedAppointments, setBookedAppointments] = useState<AppointmentAgendaRow[]>(
    () => initialWizardSlots?.appointments ?? []
  );
  const [scheduleBlocks, setScheduleBlocks] = useState<
    { start_at: string; end_at: string; reason: string | null }[]
  >(() => initialWizardSlots?.scheduleBlocks ?? []);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const prefetchedProfessionalIdRef = useRef(
    initialWizardSlots && defaultProfessionalId ? defaultProfessionalId : undefined
  );
  const initialSlotSelection = useMemo(
    () => resolveInitialSlotSelection(initialStartAt, initialWizardSlots),
    [initialStartAt, initialWizardSlots]
  );
  const [selectedDay, setSelectedDay] = useState<string | null>(
    () => initialSlotSelection.day
  );
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(() => initialSlotSelection.slot);
  const [selectedExisting, setSelectedExisting] = useState<AppointmentAgendaRow | null>(null);
  const [modality, setModality] = useState<"presencial" | "virtual">("presencial");
  const [notes, setNotes] = useState("");
  const [priority, setPriority] = useState<"normal" | "high" | "urgent">("normal");
  const [isOverbooking, setIsOverbooking] = useState(false);
  const [overbookingReason, setOverbookingReason] = useState("");
  const [insuranceProvider, setInsuranceProvider] = useState(
    () => initialPatient?.insurance_provider ?? ""
  );
  const [insurancePlan, setInsurancePlan] = useState(
    () =>
      initialPatient?.insurance_plan?.trim() ||
      defaultInsurancePlanForProvider(initialPatient?.insurance_provider) ||
      ""
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [appointmentDuration, setAppointmentDuration] = useState(
    DEFAULT_APPOINTMENT_DURATION_MINUTES
  );

  const isExistingMode = selectedExisting !== null;

  const durationFilteredSlots = useMemo(
    () =>
      filterSlotsByDuration(slots, appointmentDuration, bookedAppointments, scheduleBlocks),
    [slots, appointmentDuration, bookedAppointments, scheduleBlocks]
  );

  const filteredProfessionals = useMemo(() => {
    if (!specialtyId) return professionals;
    return professionals.filter((p) => p.specialty_id === specialtyId);
  }, [professionals, specialtyId]);

  const slotsByDay = useMemo(() => {
    const map = new Map<string, Slot[]>();
    for (const slot of durationFilteredSlots) {
      const dayKey = format(parseISO(slot.start_at), "yyyy-MM-dd");
      const list = map.get(dayKey) ?? [];
      list.push(slot);
      map.set(dayKey, list);
    }
    return map;
  }, [durationFilteredSlots]);

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
    (id: string, picked?: PatientSearchOption) => {
      setPatientId(id);
      if (!id) {
        setSelectedPatient(null);
        setInsuranceProvider("");
        setInsurancePlan("");
        return;
      }

      const fromList = patientOptions.find((p) => p.id === id);
      const found = mergePatientSelection(id, fromList, picked);

      setSelectedPatient(found);
      setInsuranceProvider(found?.insurance_provider ?? "");
      setInsurancePlan(
        found?.insurance_plan?.trim() ||
          defaultInsurancePlanForProvider(found?.insurance_provider)
      );
    },
    [patientOptions]
  );

  const insuranceProviders = useMemo(
    () => insuranceProviderOptions(insuranceProvider),
    [insuranceProvider]
  );

  const insurancePlans = useMemo(
    () => insurancePlanOptionsForProvider(insuranceProvider, insurancePlan),
    [insuranceProvider, insurancePlan]
  );

  const handleInsuranceProviderChange = useCallback((provider: string) => {
    setInsuranceProvider(provider);
    setInsurancePlan(defaultInsurancePlanForProvider(provider));
  }, []);

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

  useEffect(() => {
    const proId = defaultProfessional?.id;
    if (!proId) return;

    if (prefetchedProfessionalIdRef.current === proId) {
      prefetchedProfessionalIdRef.current = undefined;
      return;
    }

    let cancelled = false;

    void (async () => {
      setLoadingSlots(true);
      const result = await fetchTurnosWizardSlots(proId);
      if (cancelled) return;

      setLoadingSlots(false);

      if (result.error) {
        toast.error(result.error);
        setSlots([]);
        setBookedAppointments([]);
        setScheduleBlocks([]);
        return;
      }

      setSlots(result.slots);
      setBookedAppointments(result.appointments);
      setScheduleBlocks(result.scheduleBlocks);

      if (!initialStartAt) return;

      const targetTime = parseISO(initialStartAt).getTime();
      const slot =
        result.slots.find((entry) => entry.start_at === initialStartAt) ??
        result.slots.find((entry) => parseISO(entry.start_at).getTime() === targetTime);

      if (!slot) return;

      setSelectedDay(format(parseISO(slot.start_at), "yyyy-MM-dd"));
      setSelectedSlot(slot);
    })();

    return () => {
      cancelled = true;
    };
  }, [defaultProfessional?.id, initialStartAt, initialWizardSlots]);

  const handleSelectFreeSlot = useCallback((slot: Slot) => {
    setSelectedSlot(slot);
    setSelectedExisting(null);
    setError(null);
  }, []);

  const handleDurationChange = useCallback(
    (minutes: number) => {
      setAppointmentDuration(minutes);
      setSelectedSlot((current) => {
        if (!current) return null;
        return slotSupportsDuration(
          current.start_at,
          minutes,
          bookedAppointments,
          scheduleBlocks
        )
          ? current
          : null;
      });
      setError(null);
    },
    [bookedAppointments, scheduleBlocks]
  );

  const handleSelectExisting = useCallback(
    (appointment: AppointmentAgendaRow) => {
      setSelectedExisting(appointment);
      setSelectedSlot(null);
      setError(null);
      const apptPatient = appointment.patients as
        | {
            first_name: string;
            last_name: string;
            document_number?: string;
            insurance_provider?: string | null;
            insurance_plan?: string | null;
          }
        | undefined;
      handlePatientChange(
        appointment.patient_id,
        apptPatient
          ? {
              id: appointment.patient_id,
              first_name: apptPatient.first_name,
              last_name: apptPatient.last_name,
              document_number: apptPatient.document_number ?? "",
              insurance_provider: apptPatient.insurance_provider ?? null,
              insurance_plan: apptPatient.insurance_plan ?? null,
            }
          : undefined
      );
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
    setAppointmentDuration(DEFAULT_APPOINTMENT_DURATION_MINUTES);
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
      end_at: resolveAppointmentEndAt(selectedSlot.start_at, appointmentDuration),
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
    appointmentDuration,
    router,
  ]);

  const professional = professionals.find((p) => p.id === professionalId);
  const specialty = specialties.find((s) => s.id === specialtyId);
  const location = locations.find((l) => l.id === locationId);

  const dayAppointments = selectedDay ? (appointmentsByDay.get(selectedDay) ?? []) : [];
  const daySlots = selectedDay ? (slotsByDay.get(selectedDay) ?? []) : [];

  return (
    <div className="turnos-nuevo-wizard mx-auto max-w-[1600px] space-y-4 text-slate-950">
      <div>
        <h1 className="text-xl font-bold text-slate-950">Nuevo turno</h1>
        <p className={MUTED_CLASS}>
          Elegí profesional, paciente y horario. Gestioná turnos existentes desde el panel de acciones.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-12 lg:items-start">
        <div className="flex flex-col gap-4 lg:col-span-3">
          <Card title="1 · Profesional" className={TURNOS_CARD_CLASS}>
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

          <Card title="2 · Paciente" className={cn(TURNOS_CARD_CLASS, "min-h-[280px]")}>
            <PatientSearchCombobox
              patients={patientOptions}
              searchMode="remote"
              minSearchLength={1}
              displayMode="detailed"
              required={!isExistingMode}
              defaultPatientId={patientId}
              onPatientChange={handlePatientChange}
              createPatientHref={(q) => buildCreatePatientHref(q, "/turnos/nuevo")}
            />
            {displayedPatient ? (
              <dl className="mt-4 space-y-2 rounded-lg border border-slate-300 bg-slate-100/80 p-3 text-sm">
                <div className="flex justify-between gap-2">
                  <dt className="font-semibold text-slate-700">Nombre</dt>
                  <dd className="font-bold text-slate-950">
                    {`${displayedPatient.last_name}, ${displayedPatient.first_name}`}
                  </dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="font-semibold text-slate-700">DNI</dt>
                  <dd className="font-bold text-slate-950">{displayedPatient.document_number || "—"}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="font-semibold text-slate-700">Obra social</dt>
                  <dd className="font-bold text-slate-950">
                    {displayedPatient.insurance_provider ?? "Particular"}
                  </dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="font-semibold text-slate-700">Plan</dt>
                  <dd className="font-bold text-slate-950">
                    {displayedPatient.insurance_plan?.trim() ||
                      defaultInsurancePlanForProvider(displayedPatient.insurance_provider) ||
                      "—"}
                  </dd>
                </div>
              </dl>
            ) : null}
          </Card>
        </div>

        <Card title="3 · Horarios" className={cn(TURNOS_CARD_CLASS, "lg:col-span-6 lg:min-h-[560px]")}>
          <div className="space-y-4">
            {!professionalId ? (
              <p className={MUTED_CLASS}>Seleccioná un profesional para ver la disponibilidad.</p>
            ) : loadingSlots ? (
              <p className={`flex items-center gap-2 ${MUTED_CLASS}`}>
                <Loader2 className="h-4 w-4 animate-spin" /> Cargando disponibilidad…
              </p>
            ) : dayKeys.length === 0 ? (
              <p className={MUTED_CLASS}>
                No hay horarios ni turnos agendados para este profesional en las próximas semanas.
              </p>
            ) : (
              <>
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
                        className={`rounded-md border px-3 py-2 text-sm text-slate-950 transition-colors ${
                          selectedDay === dayKey
                            ? "border-[var(--primary)] bg-[var(--primary)]/10 font-semibold"
                            : "border-slate-400 hover:border-[var(--primary)]"
                        }`}
                      >
                        {format(date, "EEE d MMM", { locale: es })}
                        <span className="ml-1 text-xs font-medium text-slate-700">
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
                        <p className={SECTION_HEADING}>Agendados</p>
                        <div className="grid gap-2 sm:grid-cols-2">
                          {dayAppointments.map((appointment) => (
                            <button
                              key={appointment.id}
                              type="button"
                              onClick={() => handleSelectExisting(appointment)}
                              className={`rounded-md border px-3 py-2 text-left text-sm transition-colors ${
                                selectedExisting?.id === appointment.id
                                  ? "border-orange-500 bg-orange-50 font-semibold text-slate-900 ring-1 ring-orange-500"
                                  : "border-orange-200 bg-orange-50/80 text-slate-900 hover:border-orange-400"
                              }`}
                            >
                              <span className="font-semibold">
                                {format(parseISO(appointment.start_at), "HH:mm", { locale: es })} hs
                              </span>
                              <span className="block truncate text-xs font-medium text-slate-800">
                                {getPatientName(appointment)}
                              </span>
                              <span className="block text-xs text-slate-600">
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
                        <p className={SECTION_HEADING}>Disponibles</p>
                        <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-4">
                          {daySlots.map((slot) => (
                            <button
                              key={slot.start_at}
                              type="button"
                              onClick={() => handleSelectFreeSlot(slot)}
                              className={`rounded-md border px-3 py-2 text-left text-sm text-slate-950 transition-colors ${
                                selectedSlot?.start_at === slot.start_at
                                  ? "border-[var(--primary)] bg-[var(--primary)]/10 font-semibold ring-1 ring-[var(--primary)]"
                                  : "border-slate-400 hover:border-[var(--primary)]"
                              }`}
                            >
                              <span className="font-semibold">
                                {format(parseISO(slot.start_at), "HH:mm", { locale: es })} hs
                              </span>
                              <span className="block text-xs font-medium text-slate-700">
                                {appointmentDuration} min
                              </span>
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : dayAppointments.length === 0 ? (
                      <p className={MUTED_CLASS}>No hay horarios libres ni turnos este día.</p>
                    ) : (
                      <p className={MUTED_CLASS}>No quedan horarios libres este día.</p>
                    )}

                    {selectedExisting ? (
                      <ExistingAppointmentCancelPanel
                        key={selectedExisting.id}
                        appointment={selectedExisting}
                        onCancelled={() => void loadProfessionalData(professionalId)}
                      />
                    ) : null}
                  </div>
                ) : (
                  <p className={MUTED_CLASS}>Elegí un día para ver los horarios.</p>
                )}
              </>
            )}

            {professionalId && !loadingSlots ? (
              <div className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-300 pt-4">
                <span className="mr-auto flex items-center gap-1.5 text-sm font-semibold text-slate-800">
                  <Clock3 className="h-4 w-4" />
                  Duración de atención
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {APPOINTMENT_DURATION_OPTIONS.map((minutes) => (
                    <button
                      key={minutes}
                      type="button"
                      onClick={() => handleDurationChange(minutes)}
                      className={cn(
                        "rounded-md border px-3 py-1.5 text-sm font-medium transition-colors",
                        appointmentDuration === minutes
                          ? "border-[var(--primary)] bg-[var(--primary)]/10 font-semibold text-slate-950 ring-1 ring-[var(--primary)]"
                          : "border-slate-400 text-slate-700 hover:border-[var(--primary)]"
                      )}
                    >
                      {minutes} min
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </Card>

        <div className="flex flex-col gap-4 lg:col-span-3">
          <Card
            title={isExistingMode ? "4 · Turno existente" : "4 · Confirmación"}
            className={cn(TURNOS_CARD_CLASS, "lg:sticky lg:top-4")}
          >
            {isExistingMode && selectedExisting ? (
              <ExistingAppointmentSummary
                appointment={selectedExisting}
                appointments={bookedAppointments}
                scheduleBlocks={scheduleBlocks}
                defaultDuration={defaultDuration}
                onUpdated={() => void loadProfessionalData(professionalId)}
              />
            ) : (
              <>
                <dl className="space-y-3 text-sm">
                  <SummaryRow label="Profesional">
                    {professional ? getProfessionalDisplayName(professional) : "—"}
                  </SummaryRow>
                  <SummaryRow label="Paciente">
                    {displayedPatient
                      ? `${displayedPatient.last_name}, ${displayedPatient.first_name}`
                      : "—"}
                  </SummaryRow>
                  <SummaryRow label="Horario">
                    {selectedSlot
                      ? `${format(parseISO(selectedSlot.start_at), "EEE d MMM · HH:mm 'hs'", { locale: es })} (${appointmentDuration} min)`
                      : "—"}
                  </SummaryRow>
                  <SummaryRow label="Especialidad / Consultorio">
                    {specialty?.name ?? "—"}
                    {location ? ` · ${location.name}` : ""}
                  </SummaryRow>
                </dl>

                {error ? <p className="mt-3 text-sm font-medium text-red-600">{error}</p> : null}

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

            <Button
              type="button"
              variant="ghost"
              className="mt-3 w-full text-slate-700"
              onClick={handleClear}
              disabled={
                submitting ||
                (!patientId && !selectedSlot && !selectedExisting && !professionalId)
              }
            >
              <RotateCcw className="mr-1 h-4 w-4" />
              Limpiar selección
            </Button>
          </Card>

          {!isExistingMode ? (
            <Card title="Modificación" className={TURNOS_CARD_CLASS}>
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
                  <Select
                    label="Obra social"
                    value={insuranceProvider}
                    onChange={(e) => handleInsuranceProviderChange(e.target.value)}
                    options={[
                      { value: "", label: "Seleccioná…" },
                      ...insuranceProviders.map((provider) => ({
                        value: provider,
                        label: provider,
                      })),
                    ]}
                  />
                  <Select
                    label="Plan"
                    value={insurancePlan}
                    onChange={(e) => setInsurancePlan(e.target.value)}
                    disabled={!insuranceProvider}
                    options={[
                      {
                        value: "",
                        label: insuranceProvider ? "Seleccioná…" : "Elegí obra social primero",
                      },
                      ...insurancePlans.map((plan) => ({
                        value: plan,
                        label: plan,
                      })),
                    ]}
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
        </div>
      </div>
    </div>
  );
}
