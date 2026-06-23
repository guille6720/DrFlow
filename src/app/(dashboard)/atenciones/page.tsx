import { Header } from "@/components/layout/header";
import { PatientAttendanceRegister } from "@/components/atenciones/patient-attendance-register";
import {
  getActiveClinic,
  getActiveClinicId,
  getProfile,
  getUserClinics,
} from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import {
  getAttendancePeriodBounds,
  summarizeAttendedAppointments,
  type AttendancePeriod,
} from "@/lib/utils/attendance-stats";
import type { ConsultationModality } from "@/lib/constants/consultation-modality";
import { DEFAULT_CLINIC_TIMEZONE } from "@/lib/utils/clinic-timezone";

const VALID_PERIODS = new Set<AttendancePeriod>(["daily", "weekly", "monthly"]);

export default async function AtencionesPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  const { period: periodParam } = await searchParams;
  const period: AttendancePeriod = VALID_PERIODS.has(periodParam as AttendancePeriod)
    ? (periodParam as AttendancePeriod)
    : "daily";

  const profile = await getProfile();
  const clinics = await getUserClinics();
  const clinicId = await getActiveClinicId();
  const { role, clinic } = await getActiveClinic();
  const supabase = await createClient();

  const timeZone = clinic?.timezone ?? DEFAULT_CLINIC_TIMEZONE;
  const { start, end, label } = getAttendancePeriodBounds(period, new Date(), timeZone);

  let summary = summarizeAttendedAppointments([]);
  let items: {
    id: string;
    start_at: string;
    consultation_modality: ConsultationModality | null;
    patientName: string;
    professionalName: string;
    patientId: string;
  }[] = [];

  if (clinicId) {
    const { data } = await supabase
      .from("appointments")
      .select(
        "id, start_at, consultation_modality, patient_id, patients(first_name, last_name), professionals(profiles(full_name))"
      )
      .eq("clinic_id", clinicId)
      .eq("status", "attended")
      .gte("start_at", start.toISOString())
      .lt("start_at", end.toISOString())
      .order("start_at", { ascending: false });

    const rows = (data ?? []).map((row) => ({
      id: row.id,
      start_at: row.start_at,
      consultation_modality: (row.consultation_modality as ConsultationModality | null) ?? "presencial",
      patient_id: row.patient_id,
      patients: row.patients as unknown as { first_name: string; last_name: string } | null,
      professionals: row.professionals as unknown as {
        profiles?: { full_name?: string } | null;
      } | null,
    }));

    summary = summarizeAttendedAppointments(rows);
    items = rows.map((row) => ({
      id: row.id,
      start_at: row.start_at,
      consultation_modality: row.consultation_modality,
      patientId: row.patient_id,
      patientName: row.patients
        ? `${row.patients.last_name}, ${row.patients.first_name}`
        : "Paciente",
      professionalName: row.professionals?.profiles?.full_name ?? "Profesional",
    }));
  }

  return (
    <>
      <Header
        title="Registro de atenciones"
        subtitle="Pacientes atendidos por día, semana y mes"
        clinics={clinics}
        activeClinicId={clinicId}
        role={role}
        userName={profile?.full_name}
      />

      <div className="p-4 sm:p-6">
        <PatientAttendanceRegister
          period={period}
          periodLabel={label}
          summary={summary}
          items={items}
        />
      </div>
    </>
  );
}
